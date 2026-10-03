import { createClient } from "@/lib/supabase/client";
import { runOcr } from "@/actions/ocr";

const MAX_BYTES = 5 * 1024 * 1024;

export type ScanStage = "upload" | "ocr";
export type ScanResult = { text?: string } | { error: string; signedOut?: boolean };

/**
 * Uploads a receipt photo to the user's private folder and reads its text:
 * OCR.space on the server first, Tesseract in the browser if that fails.
 * The photo is deleted from storage as soon as the server has read it: it is only needed for OCR,
 * so nothing piles up. `text` is undefined when nothing could be read.
 */
export async function scanReceipt(file: File, onStage: (stage: ScanStage) => void): Promise<ScanResult> {
  if (!file.type.startsWith("image/")) return { error: "Please choose an image." };
  if (file.size > MAX_BYTES) return { error: "Image must be under 5 MB." };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in.", signedOut: true };

  onStage("upload");
  const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) return { error: error.message };

  onStage("ocr");
  let text: string | undefined;
  try {
    text = (await runOcr(path)).text;
  } catch (err) {
    console.error("[ocr] server action failed", err);
  }
  const { error: removeError } = await supabase.storage.from("receipts").remove([path]);
  if (removeError) console.error("[receipt] could not delete uploaded photo", removeError.message);
  if (!text) {
    try {
      const { tesseractOcr } = await import("@/lib/tesseract-fallback");
      text = await tesseractOcr(file);
    } catch (err) {
      console.error("[ocr] tesseract fallback failed", err);
    }
  }
  return { text };
}
