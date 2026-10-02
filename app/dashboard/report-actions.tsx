"use client";
import { Download, MessageCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { formatIdr } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Row = { date: string | null; merchant: string | null; category: string | null; type: string | null; amount: number | string | null };

export function ReportActions({ rows, monthTotal, monthIncome, topCategory }: { rows: Row[]; monthTotal: number; monthIncome: number; topCategory: string }) {
  function exportXlsx() {
    const data = rows.map((r) => ({ Date: r.date, Merchant: r.merchant, Category: r.category, Type: r.type, Amount: Number(r.amount ?? 0) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Transactions");
    XLSX.writeFile(wb, "Finance_Report.xlsx");
  }

  function shareWhatsApp() {
    const text = `Hello! Here is the spending update for this month: Expenses: ${formatIdr(monthTotal)}. Income: ${formatIdr(monthIncome)}. Top category: ${topCategory}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportXlsx} disabled={!rows.length}><Download /> Export to Excel</Button>
      <Button variant="outline" onClick={shareWhatsApp}><MessageCircle /> Share to WhatsApp</Button>
    </div>
  );
}
