import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIdr } from "@/lib/format";
import { MONTHS_ID, currentPeriod, monthRange, parsePeriod } from "@/lib/periods";
import { DashboardFilters } from "./dashboard-filters";
import { TransactionRow } from "./transaction-row";
import { ReportActions } from "./report-actions";

export default async function Dashboard(props: PageProps<"/dashboard">) {
  const query = await props.searchParams;
  const { month, year } = parsePeriod(query.month, query.year);
  const [start, end] = monthRange(year, month);

  const supabase = await createClient();
  const [{ data, error }, { data: oldest }] = await Promise.all([
    supabase.from("transactions").select("*").gte("date", start).lt("date", end).order("date", { ascending: false }),
    supabase.from("transactions").select("date").not("date", "is", null).order("date", { ascending: true }).limit(1),
  ]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  // every year from the oldest transaction to now (and the selected one, in case it's outside that range)
  const thisYear = currentPeriod().year;
  const firstYear = Math.min(oldest?.[0]?.date ? Number(oldest[0].date.slice(0, 4)) : thisYear, year);
  const years = Array.from({ length: Math.max(thisYear, year) - firstYear + 1 }, (_, i) => firstYear + i).reverse();

  const sum = (type: string) => rows.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const spent = sum("expense");
  const income = sum("income");
  const byCategory = new Map<string, number>();
  rows.filter((r) => r.type === "expense").forEach((r) => {
    const category = r.category || "Uncategorized";
    byCategory.set(category, (byCategory.get(category) ?? 0) + Number(r.amount ?? 0));
  });
  const [topCategory, topAmount] = [...byCategory].sort((a, b) => b[1] - a[1])[0] ?? ["n/a", 0];

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DashboardFilters month={month} year={year} years={years} />
        <ReportActions rows={rows} month={month} year={year} monthTotal={spent} monthIncome={income} topCategory={topCategory} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Card className="bg-stone-900 text-stone-50">
          <CardHeader><CardTitle className="text-sm font-normal uppercase tracking-widest text-stone-400">Total Spent · {MONTHS_ID[month - 1]} {year}</CardTitle></CardHeader>
          <CardContent>
            <p className="font-serif text-5xl">{formatIdr(spent)}</p>
            <p className="mt-2 text-sm text-stone-400">In {formatIdr(income)} · Balance {formatIdr(income - spent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-normal uppercase tracking-widest text-stone-500">Top Category</CardTitle></CardHeader>
          <CardContent>
            <p className="font-serif text-3xl">{topCategory}</p>
            {topAmount > 0 && <p className="text-sm text-stone-500">{formatIdr(topAmount)}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Merchant</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-stone-500">Tidak ada transaksi di bulan ini</TableCell></TableRow>}
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
