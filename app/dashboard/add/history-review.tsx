"use client";
import { Loader2, X } from "lucide-react";
import type { ParsedReceipt } from "@/lib/parse-receipt";
import { txKey } from "@/lib/duplicates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HistoryReviewProps {
  entries: ParsedReceipt[];
  saved: Set<string>;
  saving: boolean;
  onChange: (entries: ParsedReceipt[]) => void;
  onSave: () => void;
}

export function HistoryReview({ entries, saved, saving, onChange, onSave }: HistoryReviewProps) {
  const update = (i: number, patch: Partial<ParsedReceipt>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const isDupe = (e: ParsedReceipt) => saved.has(txKey(e));
  const dupes = entries.filter(isDupe).length;
  const valid = entries.length > 0 && entries.every((e) => e.merchant && Number(e.amount) > 0 && e.date);

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-serif text-xl">{entries.length} transactions found — review before saving</h2>
      {dupes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="status">
          {dupes} already saved (same merchant, amount and date).
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(entries.filter((e) => !isDupe(e)))}>Skip duplicates</Button>
        </div>
      )}
      <ul className="grid gap-3">
        {entries.map((e, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] gap-2 border-t border-border pt-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
            <div className="grid gap-1">
              <Input aria-label="Merchant" value={e.merchant} onChange={(ev) => update(i, { merchant: ev.target.value })} />
              {isDupe(e) && <span className="text-xs text-amber-700 dark:text-amber-400">Already saved</span>}
            </div>
            <Input aria-label="Amount" type="number" min="0" step="1" value={e.amount} onChange={(ev) => update(i, { amount: ev.target.value })} />
            <Input aria-label="Date" type="date" value={e.date} onChange={(ev) => update(i, { date: ev.target.value })} />
            <button
              type="button"
              onClick={() => update(i, { type: e.type === "income" ? "expense" : "income" })}
              className={`rounded-lg px-3 text-sm font-medium ${e.type === "income" ? "bg-primary text-primary-foreground" : "bg-rose-700 text-white"}`}
            >
              {e.type === "income" ? "Income" : "Expense"}
            </button>
            <button type="button" aria-label="Remove" onClick={() => onChange(entries.filter((_, idx) => idx !== i))} className="px-2 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={onSave} disabled={saving || !valid} className="bg-primary hover:bg-primary/90">
        {saving ? <><Loader2 className="animate-spin" /> Saving…</> : `Save ${entries.length} transactions`}
      </Button>
    </div>
  );
}
