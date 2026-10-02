"use client";
import { useState } from "react";
import { Download, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, type ExportRow } from "@/lib/export-excel";
import { formatIdr } from "@/lib/format";
import { MONTHS_ID } from "@/lib/periods";
import { Button } from "@/components/ui/button";

interface ReportActionsProps {
  rows: ExportRow[];
  month: number;
  year: number;
  monthTotal: number;
  monthIncome: number;
  topCategory: string;
}

export function ReportActions({ rows, month, year, monthTotal, monthIncome, topCategory }: ReportActionsProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel(rows, month, year);
    } catch (err) {
      console.error("[export] failed", err);
      toast.error("Gagal membuat file Excel.");
    } finally {
      setExporting(false);
    }
  }

  function shareWhatsApp() {
    const text = `Hello! Here is the spending update for ${MONTHS_ID[month - 1]} ${year}: Expenses: ${formatIdr(monthTotal)}. Income: ${formatIdr(monthIncome)}. Top category: ${topCategory}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handleExport} disabled={!rows.length || exporting}>
        {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export to Excel
      </Button>
      <Button variant="outline" onClick={shareWhatsApp}><MessageCircle /> Share to WhatsApp</Button>
    </div>
  );
}
