import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { extractedReceiptSchema, normalizeReceipt } from "@/lib/receipt-schema";

export const maxDuration = 30;

const MAX_TEXT_LENGTH = 8000;
// "-latest" aliases survive Google retiring versioned names; the lite model is the fallback when the main one is overloaded (503)
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-flash-latest", "gemini-flash-lite-latest"];

const SYSTEM_PROMPT = `You extract structured data from OCR text of restaurant/cafe receipts (mostly Indonesian, amounts in Rupiah).
Respond with JSON only, matching the schema. Rules:
- items: one entry per menu line. qty is the quantity ordered; total_price is that line's total (qty x unit price) as printed, BEFORE tax/service.
- Modifiers and notes (e.g. "> sambal pisah", "+0 Normal Ice", "Less Sugar") are not separate items: ignore them, or append them to the menu name.
- Amounts are plain numbers in rupiah: "54.000", "54,000" and "54 000" all mean 54000. Never output decimals for thousands separators.
- subtotal: the printed subtotal; if absent, the sum of all item total_price.
- tax: EVERYTHING added between subtotal and total: PPN/PB1/tax, service charge, other fees, rounding, minus discounts/vouchers (may be negative). It must hold that subtotal + tax = total.
- total: the final amount the customer paid.
- merchant: the venue name if visible, else "". date: the receipt date as YYYY-MM-DD if visible, else "".
- Do not invent items. If a value is unreadable, make the best estimate that keeps subtotal + tax = total.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: "string" },
    date: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { qty: { type: "integer" }, name: { type: "string" }, total_price: { type: "number" } },
        required: ["qty", "name", "total_price"],
      },
    },
    subtotal: { type: "number" },
    tax: { type: "number" },
    total: { type: "number" },
  },
  required: ["items", "subtotal", "tax", "total"],
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[extract-receipt] GEMINI_API_KEY is not set");
    return NextResponse.json({ error: "Receipt extraction is not configured" }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text.trim() : "";
  if (!text) return NextResponse.json({ error: "Missing receipt text" }, { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: "Receipt text is too long" }, { status: 413 });

  try {
    const ai = new GoogleGenAI({ apiKey });
    let raw = "";
    let lastError: unknown;
    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: text,
          config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA, temperature: 0 },
        });
        raw = response.text ?? "";
        break;
      } catch (err) {
        console.error(`[extract-receipt] model ${model} failed`, err instanceof Error ? err.message.slice(0, 300) : err);
        lastError = err;
      }
    }
    if (!raw) throw lastError ?? new Error("empty model response");
    const parsed = extractedReceiptSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error("[extract-receipt] model output failed validation", parsed.error.message);
      return NextResponse.json({ error: "Could not understand this receipt" }, { status: 422 });
    }
    return NextResponse.json(normalizeReceipt(parsed.data));
  } catch (err) {
    console.error("[extract-receipt] LLM call failed", err);
    return NextResponse.json({ error: "Receipt extraction failed, please try again" }, { status: 502 });
  }
}
