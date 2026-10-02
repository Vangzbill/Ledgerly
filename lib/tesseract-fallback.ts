export async function tesseractOcr(file: File): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(file, "eng+ind");
  return data.text;
}
