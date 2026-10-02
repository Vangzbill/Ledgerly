"use client";
import { Loader2, X } from "lucide-react";
import type { ParsedReceipt } from "@/lib/parse-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HistoryReviewProps {
  entries: ParsedReceipt[];
  saving: boolean;
  onChange: (entries: ParsedReceipt[]) => void;
  onSave: () => void;
}

export function HistoryReview({ entries, saving, onChange, onSave }: HistoryReviewProps) {
  const update = (i: number, patch: Partial<ParsedReceipt>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const valid = entries.length > 0 && entries.every((e) => e.merchant && Number(e.amount) > 0 && e.date);

  return (
    <div className="grid gap-3 rounded-xl border border-stone-300 bg-white p-4">
      <h2 className="font-serif text-xl">{entries.length} transactions found — review before saving</h2>
      <ul className="grid gap-3">
        {entries.map((e, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] gap-2 border-t border-stone-200 pt-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
            <Input aria-label="Merchant" value={e.merchant} onChange={(ev) => update(i, { merchant: ev.target.value })} />
            <Input aria-label="Amount" type="number" min="0" step="1" value={e.amount} onChange={(ev) => update(i, { amount: ev.target.value })} />
            <Input aria-label="Date" type="date" value={e.date} onChange={(ev) => update(i, { date: ev.target.value })} />
            <button
              type="button"
              onClick={() => update(i, { type: e.type === "income" ? "expense" : "income" })}
              className={`rounded-lg px-3 text-sm font-medium text-white ${e.type === "income" ? "bg-emerald-800" : "bg-rose-700"}`}
            >
              {e.type === "income" ? "Income" : "Expense"}
            </button>
            <button type="button" aria-label="Remove" onClick={() => onChange(entries.filter((_, idx) => idx !== i))} className="px-2 text-stone-500 hover:text-stone-900">
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={onSave} disabled={saving || !valid} className="bg-emerald-800 hover:bg-emerald-900">
        {saving ? <><Loader2 className="animate-spin" /> Saving…</> : `Save ${entries.length} transactions`}
      </Button>
    </div>
  );
}
