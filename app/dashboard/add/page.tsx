"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { scanReceipt } from "@/lib/scan-receipt";
import { parseReceipt, type ParsedReceipt } from "@/lib/parse-receipt";
import { parseHistory } from "@/lib/parse-history";
import { HistoryReview } from "./history-review";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const empty = { merchant: "", amount: "", date: "", category: "", type: "expense" as "income" | "expense" };

export default function AddReceipt() {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "upload" | "ocr" | "save">("");
  const [preview, setPreview] = useState("");
  const [receiptPath, setReceiptPath] = useState("");
  const [form, setForm] = useState(empty);
  const [drag, setDrag] = useState(false);
  const [rawText, setRawText] = useState("");
  const [entries, setEntries] = useState<ParsedReceipt[]>([]);

  async function handleFile(file?: File) {
    if (!file) return;
    if (file.type.startsWith("image/")) setPreview(URL.createObjectURL(file));
    const scan = await scanReceipt(file, setBusy);
    setBusy("");
    if ("error" in scan) {
      if (scan.signedOut) return router.push("/login");
      return toast.error(scan.error);
    }
    setReceiptPath(scan.path);
    const text = scan.text;
    if (!text) return toast.error("Could not read the receipt — please fill it in manually.");
    setRawText(text);
    const history = parseHistory(text);
    setEntries(history);
    if (history.length) return toast.success(`Found ${history.length} transactions. Please review.`);
    const parsed = parseReceipt(text);
    setForm((f) => ({ ...f, ...parsed }));
    toast.success("Receipt scanned. Please review.");
  }

  async function saveAll() {
    setBusy("save");
    const { error } = await createClient().from("transactions").insert(
      entries.map((e) => ({ ...e, amount: Number(e.amount), category: e.category || null, receipt_path: receiptPath || null })),
    );
    setBusy("");
    if (error) return toast.error(error.message);
    toast.success(`${entries.length} transactions saved`);
    router.push("/dashboard");
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    const { error } = await createClient().from("transactions").insert({
      merchant: form.merchant,
      amount: Number(form.amount),
      date: form.date || null,
      category: form.category || null,
      type: form.type,
      receipt_path: receiptPath || null,
    });
    setBusy("");
    if (error) return toast.error(error.message);
    toast.success("Transaction saved");
    router.push("/dashboard");
    router.refresh();
  }

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="mx-auto grid max-w-3xl gap-6 px-4 py-8 md:grid-cols-2">
      <div className="grid gap-2">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition ${drag ? "border-emerald-700 bg-emerald-50" : "border-stone-400 bg-white"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Receipt preview" className="max-h-72 rounded" />
        ) : (
          <><Camera className="size-8 text-emerald-800" /><span className="font-serif text-xl">Choose from gallery or drop a receipt</span></>
        )}
        {busy && busy !== "save" && (
          <span className="flex items-center gap-2 text-sm text-stone-600">
            <Loader2 className="size-4 animate-spin" />{busy === "upload" ? "Uploading…" : "Reading receipt… (can take a few seconds)"}
          </span>
        )}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>
      <label className={`${buttonVariants({ variant: "outline" })} cursor-pointer`}>
        <Camera /> Take a photo
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>
      </div>

      {entries.length ? (
        <div className="md:col-span-2"><HistoryReview entries={entries} saving={busy === "save"} onChange={setEntries} onSave={saveAll} /></div>
      ) : (
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl">Review</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1" role="radiogroup" aria-label="Transaction type">
              {(["expense", "income"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={form.type === t} onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-md py-1.5 text-sm font-medium transition ${form.type === t ? (t === "income" ? "bg-emerald-800 text-white" : "bg-rose-700 text-white") : "text-stone-600"}`}>
                  {t === "income" ? "Income" : "Expense"}
                </button>
              ))}
            </div>
            <div className="grid gap-2"><Label htmlFor="merchant">Merchant</Label><Input id="merchant" value={form.merchant} onChange={set("merchant")} required /></div>
            <div className="grid gap-2"><Label htmlFor="amount">Total (IDR)</Label><Input id="amount" type="number" step="1" min="0" value={form.amount} onChange={set("amount")} required /></div>
            <div className="grid gap-2"><Label htmlFor="date">Date</Label><Input id="date" type="date" value={form.date} onChange={set("date")} required /></div>
            <div className="grid gap-2"><Label htmlFor="category">Category</Label><Input id="category" value={form.category} onChange={set("category")} placeholder="Groceries" /></div>
            <Button type="submit" disabled={busy !== ""} className="bg-emerald-800 hover:bg-emerald-900">{busy === "save" ? <><Loader2 className="animate-spin" /> Saving…</> : "Save Transaction"}</Button>
          </form>
        </CardContent>
      </Card>
      )}
      {rawText && (
        <details className="text-sm text-stone-600 md:col-span-2">
          <summary className="cursor-pointer">Show scanned text</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">{rawText}</pre>
        </details>
      )}
    </section>
  );
}
