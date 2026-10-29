import { createClient } from "./supabase/client";

type TxLike = { merchant?: string | null; amount?: string | number | null; date?: string | null };

// Same merchant (case/space-insensitive), amount and date = same transaction.
export const txKey = (t: TxLike) => `${(t.merchant ?? "").trim().replace(/\s+/g, " ").toLowerCase()}|${Number(t.amount)}|${t.date ?? ""}`;

// Keys of `entries` already saved by the signed-in user (RLS scopes the query to them).
export async function existingKeys(entries: TxLike[]): Promise<Set<string>> {
  const dates = [...new Set(entries.flatMap((e) => (e.date ? [e.date] : [])))];
  if (!dates.length) return new Set();
  const { data, error } = await createClient().from("transactions").select("merchant, amount, date").in("date", dates);
  if (error) throw error;
  return new Set(data.map(txKey));
}

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("duplicates.ts")) {
  const a = txKey({ merchant: "  Jago   Coffee ", amount: "8000", date: "2026-10-02" });
  const b = txKey({ merchant: "jago coffee", amount: 8000.0, date: "2026-10-02" });
  if (a !== b) throw new Error(`duplicates: ${a} !== ${b}`);
  if (a === txKey({ merchant: "jago coffee", amount: 8000, date: "2026-10-03" })) throw new Error("duplicates: date ignored");
  console.log("duplicates ok");
}
