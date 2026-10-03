"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatIdr } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";

export interface Transaction {
  id: string;
  date: string | null;
  merchant: string | null;
  category: string | null;
  type: string | null;
  amount: number | string | null;
}

export function TransactionRow({ tx }: { tx: Transaction }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ ...tx, amount: String(tx.amount ?? "") });
  const income = tx.type === "income";

  async function run(op: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    setBusy(true);
    const { error } = await op();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(done);
    setMode("view");
    router.refresh();
  }

  const save = () =>
    run(
      () => createClient().from("transactions").update({
        merchant: draft.merchant, category: draft.category || null, date: draft.date || null,
        type: draft.type, amount: Number(draft.amount),
      }).eq("id", tx.id),
      "Transaction updated",
    );
  const remove = () => run(() => createClient().from("transactions").delete().eq("id", tx.id), "Transaction deleted");

  if (mode === "edit") {
    const set = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [k]: e.target.value });
    return (
      <TableRow>
        <TableCell><Input aria-label="Date" type="date" value={draft.date ?? ""} onChange={set("date")} /></TableCell>
        <TableCell><Input aria-label="Merchant" value={draft.merchant ?? ""} onChange={set("merchant")} /></TableCell>
        <TableCell><Input aria-label="Category" value={draft.category ?? ""} onChange={set("category")} /></TableCell>
        <TableCell>
          <button type="button" onClick={() => setDraft({ ...draft, type: draft.type === "income" ? "expense" : "income" })}
            className={`rounded-md px-2 py-1 text-xs font-medium text-white ${draft.type === "income" ? "bg-emerald-800" : "bg-rose-700"}`}>
            {draft.type === "income" ? "Income" : "Expense"}
          </button>
        </TableCell>
        <TableCell><Input aria-label="Amount" type="number" min="0" step="1" value={draft.amount} onChange={set("amount")} className="text-right" /></TableCell>
        <TableCell className="whitespace-nowrap text-right">
          <button type="button" aria-label="Save" disabled={busy || !draft.merchant || !(Number(draft.amount) > 0)} onClick={save} className="p-1.5 text-emerald-800 disabled:opacity-40">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </button>
          <button type="button" aria-label="Cancel" disabled={busy} onClick={() => { setDraft({ ...tx, amount: String(tx.amount ?? "") }); setMode("view"); }} className="p-1.5 text-stone-500"><X className="size-4" /></button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{tx.date}</TableCell><TableCell>{tx.merchant}</TableCell><TableCell>{tx.category}</TableCell>
      <TableCell><span className={income ? "text-emerald-700" : "text-rose-700"}>{income ? "Income" : "Expense"}</span></TableCell>
      <TableCell className={`text-right tabular-nums ${income ? "text-emerald-700" : ""}`}>{income ? "+" : "-"}{formatIdr(tx.amount)}</TableCell>
      <TableCell className="whitespace-nowrap text-right">
        {mode === "confirm" ? (
          <>
            <button type="button" disabled={busy} onClick={remove} className="rounded-md bg-rose-700 px-2 py-1 text-xs font-medium text-white">
              {busy ? <Loader2 className="size-3 animate-spin" /> : "Delete?"}
            </button>
            <button type="button" aria-label="Cancel" disabled={busy} onClick={() => setMode("view")} className="p-1.5 text-stone-500"><X className="size-4" /></button>
          </>
        ) : (
          <>
            <button type="button" aria-label="Edit" onClick={() => setMode("edit")} className="p-1.5 text-stone-500 hover:text-stone-900"><Pencil className="size-4" /></button>
            <button type="button" aria-label="Delete" onClick={() => setMode("confirm")} className="p-1.5 text-stone-500 hover:text-rose-700"><Trash2 className="size-4" /></button>
          </>
        )}
      </TableCell>
    </TableRow>
  );
}
