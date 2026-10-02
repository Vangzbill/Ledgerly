"use server";
import { createClient } from "@/lib/supabase/server";
import { isVerified } from "@/lib/parse-receipt";

const ENGINES = ["2", "1", "3"];

export async function runOcr(path: string): Promise<{ text?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) return { error: "Invalid image path" };
  const { data: signed, error: signError } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
  if (signError || !signed) return { error: "Could not access the image" };
  const imageUrl = signed.signedUrl;

  let error = "No text found";
  let fallback = ""; 
  for (const engine of ENGINES) {
    let res: Response;
    try {
      res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: { apikey: process.env.OCR_SPACE_API_KEY! },
        body: new URLSearchParams({ url: imageUrl, isTable: "true", OCREngine: engine }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      console.error(`[ocr] engine ${engine} unreachable`, err instanceof Error ? `${err.message} (${String(err.cause)})` : err);
      error = "OCR service unreachable";
      break;
    }
    if (!res.ok) {
      console.error(`[ocr] engine ${engine} HTTP`, res.status, await res.text());
      error = `OCR failed (${res.status})`;
      continue;
    }
    const json = await res.json();
    const text: string = json.ParsedResults?.[0]?.ParsedText ?? "";
    if (!json.IsErroredOnProcessing && text.trim()) {
      if (isVerified(text)) return { text };
      fallback ||= text;
      continue;
    }
    console.error(`[ocr] engine ${engine}`, JSON.stringify(json).slice(0, 500));
    error = String(json.ErrorMessage?.[0] ?? error);
  }
  return fallback ? { text: fallback } : { error };
}
