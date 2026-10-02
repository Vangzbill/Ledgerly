"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MONTHS_ID } from "@/lib/periods";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DashboardFiltersProps {
  month: number;
  year: number;
  years: number[];
}

export function DashboardFilters({ month, year, years }: DashboardFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (m: number, y: number) => startTransition(() => router.push(`/dashboard?month=${m}&year=${y}`));
  const monthItems = MONTHS_ID.map((label, i) => ({ value: String(i + 1), label }));
  const yearItems = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter periode">
      <Select items={monthItems} value={String(month)} onValueChange={(v) => v && go(Number(v), year)} disabled={pending}>
        <SelectTrigger aria-label="Bulan" className="w-40 bg-white"><SelectValue /></SelectTrigger>
        <SelectContent>{monthItems.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select items={yearItems} value={String(year)} onValueChange={(v) => v && go(month, Number(v))} disabled={pending}>
        <SelectTrigger aria-label="Tahun" className="w-28 bg-white"><SelectValue /></SelectTrigger>
        <SelectContent>{yearItems.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}</SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-stone-500" aria-label="Memuat" />}
    </div>
  );
}
