"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { scanReceipt } from "@/lib/scan-receipt";
import type { ExtractedReceipt } from "@/lib/receipt-schema";
import { Button, buttonVariants } from "@/components/ui/button";
import { SplitBill } from "./split-bill";

type Stage = "idle" | "upload" | "ocr" | "extract";

const STAGE_LABEL: Record<Exclude<Stage, "idle">, string> = {
  upload: "Mengunggah…",
  ocr: "Membaca struk… (bisa beberapa detik)",
  extract: "Mengenali daftar menu…",
};

export default function SplitBillPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState("");
  const [drag, setDrag] = useState(false);
  const [receipt, setReceipt] = useState<ExtractedReceipt | null>(null);
  const [scanCount, setScanCount] = useState(0); // remounts <SplitBill> so a new receipt starts with fresh state

  async function handleFile(file?: File) {
    if (!file) return;
    if (file.type.startsWith("image/")) setPreview(URL.createObjectURL(file));

    const scan = await scanReceipt(file, setStage);
    if ("error" in scan) {
      setStage("idle");
      if (scan.signedOut) return router.push("/login");
      return toast.error(scan.error);
    }
    if (!scan.text) {
      setStage("idle");
      return toast.error("Struk tidak terbaca. Coba foto yang lebih jelas.");
    }

    setStage("extract");
    try {
      const res = await fetch("/api/extract-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scan.text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Gagal memproses struk");
      setReceipt(body);
      setScanCount((n) => n + 1);
    } catch (err) {
      console.error("[split-bill] extraction failed", err);
      toast.error(err instanceof Error ? err.message : "Gagal memproses struk");
    } finally {
      setStage("idle");
    }
  }

  function reset() {
    setReceipt(null);
    setPreview("");
  }

  const busy = stage !== "idle";

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-4xl">Split Bill</h1>
          <p className="text-stone-600">Foto struk, pilih siapa makan apa, pajak dibagi proporsional.</p>
        </div>
        {receipt && <Button variant="outline" onClick={reset}><ArrowLeft /> Struk lain</Button>}
      </div>

      {receipt ? (
        <SplitBill key={scanCount} receipt={receipt} />
      ) : (
        <div className="grid gap-2">
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition ${drag ? "border-emerald-700 bg-emerald-50" : "border-stone-400 bg-white"}`}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Pratinjau struk" className="max-h-72 rounded" />
            ) : (
              <><Camera className="size-8 text-emerald-800" /><span className="font-serif text-xl">Pilih dari galeri atau tarik struk ke sini</span></>
            )}
            {busy && (
              <span className="flex items-center gap-2 text-sm text-stone-600" role="status">
                <Loader2 className="size-4 animate-spin" />{STAGE_LABEL[stage as Exclude<Stage, "idle">]}
              </span>
            )}
            <input type="file" accept="image/*" disabled={busy} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
          <label className={`${buttonVariants({ variant: "outline" })} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <Camera /> Take a photo
            <input type="file" accept="image/*" capture="environment" disabled={busy} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
        </div>
      )}
    </section>
  );
}
