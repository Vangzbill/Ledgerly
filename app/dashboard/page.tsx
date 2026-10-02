import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIdr } from "@/lib/format";
import { TransactionRow } from "./transaction-row";
import { ReportActions } from "./report-actions";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const sum = (list: typeof rows, type: string) => list.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const income = sum(rows, "income");
  const total = sum(rows, "expense");
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = rows.filter((r) => r.date?.startsWith(month));
  const monthTotal = sum(thisMonth, "expense");
  const monthIncome = sum(thisMonth, "income");
  const byCat = new Map<string, number>();
  thisMonth.filter((r) => r.type === "expense").forEach((r) => {
    const c = r.category || "Uncategorized";
    byCat.set(c, (byCat.get(c) ?? 0) + Number(r.amount ?? 0));
  });
  const topCategory = [...byCat].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a";

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Card className="bg-stone-900 text-stone-50">
          <CardHeader><CardTitle className="text-sm font-normal uppercase tracking-widest text-stone-400">Balance</CardTitle></CardHeader>
          <CardContent>
            <p className="font-serif text-5xl">{formatIdr(income - total)}</p>
            <p className="mt-2 text-sm text-stone-400">In {formatIdr(income)} · Out {formatIdr(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-normal uppercase tracking-widest text-stone-500">This month</CardTitle></CardHeader>
          <CardContent><p className="font-serif text-3xl">{formatIdr(monthTotal)} <span className="text-sm text-stone-500">out</span></p><p className="text-sm text-emerald-800">+{formatIdr(monthIncome)} in</p><p className="text-sm text-stone-500">Top: {topCategory}</p></CardContent>
        </Card>
      </div>

      <ReportActions rows={rows} monthTotal={monthTotal} monthIncome={monthIncome} topCategory={topCategory} />

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Merchant</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-stone-500">No transactions yet.</TableCell></TableRow>}
            {rows.map((r) => <TransactionRow key={r.id} tx={r} />)}
          </TableBody>
        </Table>
      </div>

      <Link href="/dashboard/add" aria-label="Add receipt" className={buttonVariants({ size: "lg" }) + " fixed bottom-6 right-6 h-14 rounded-full bg-emerald-800 px-5 shadow-lg hover:bg-emerald-900"}>
        <Plus /> Add receipt
      </Link>
    </section>
  );
}
