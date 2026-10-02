import type { Row, Workbook, Worksheet } from "exceljs";
import { MONTHS_ID } from "./periods";

export interface ExportRow {
  date: string | null;
  merchant: string | null;
  category: string | null;
  type: string | null;
  amount: number | string | null;
}

const IDR_FORMAT = '"Rp" #,##0';
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } } as const;
const THIN = { style: "thin", color: { argb: "FF9CA3AF" } } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function styleHeader(row: Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BORDER;
  });
}

function addBordered(sheet: Worksheet, values: (string | number | null)[], currencyColumn: number) {
  const row = sheet.addRow(values);
  row.getCell(currencyColumn).numFmt = IDR_FORMAT;
  row.eachCell((cell) => (cell.border = BORDER));
}

/** widen each column to its longest cell (header included), with a little padding */
function autoWidth(sheet: Worksheet) {
  sheet.columns.forEach((col) => {
    let longest = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const text = cell.numFmt === IDR_FORMAT ? `Rp ${Number(cell.value ?? 0).toLocaleString("id-ID")}` : String(cell.value ?? "");
      longest = Math.max(longest, text.length);
    });
    col.width = Math.min(longest + 2, 60);
  });
}

function addSummary(wb: Workbook, rows: ExportRow[], periodLabel: string) {
  const sheet = wb.addWorksheet("Ringkasan");
  const sum = (type: string) => rows.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const spent = sum("expense");
  const income = sum("income");

  sheet.addRow(["Laporan Keuangan", periodLabel]).font = { bold: true, size: 14 };
  sheet.addRow([]);
  styleHeader(sheet.addRow(["Keterangan", "Jumlah"]));
  addBordered(sheet, ["Total Pengeluaran", spent], 2);
  addBordered(sheet, ["Total Pemasukan", income], 2);
  addBordered(sheet, ["Selisih", income - spent], 2);

  sheet.addRow([]);
  styleHeader(sheet.addRow(["Kategori (Pengeluaran)", "Total"]));
  const byCategory = new Map<string, number>();
  rows.filter((r) => r.type === "expense").forEach((r) => {
    const key = r.category || "Tanpa kategori";
    byCategory.set(key, (byCategory.get(key) ?? 0) + Number(r.amount ?? 0));
  });
  for (const [category, total] of [...byCategory].sort((a, b) => b[1] - a[1])) addBordered(sheet, [category, total], 2);
  autoWidth(sheet);
}

function addDetails(wb: Workbook, rows: ExportRow[]) {
  const sheet = wb.addWorksheet("Detail Transaksi");
  styleHeader(sheet.addRow(["Tanggal", "Merchant", "Kategori", "Tipe", "Jumlah"]));
  for (const r of rows) {
    addBordered(sheet, [r.date, r.merchant, r.category, r.type === "income" ? "Pemasukan" : "Pengeluaran", Number(r.amount ?? 0)], 5);
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoWidth(sheet);
}

/** builds the styled workbook for the filtered rows and triggers the download */
export async function exportToExcel(rows: ExportRow[], month: number, year: number): Promise<void> {
  // loaded on click only: exceljs is large and not needed to render the dashboard
  const [{ default: ExcelJS }, fileSaver] = await Promise.all([import("exceljs"), import("file-saver")]);
  // file-saver is CommonJS: depending on the bundler the function is a named or a default-nested export
  const saveAs = fileSaver.saveAs ?? (fileSaver as unknown as { default: typeof fileSaver.saveAs }).default;
  const monthName = MONTHS_ID[month - 1];
  const wb = new ExcelJS.Workbook();
  addSummary(wb, rows, `${monthName} ${year}`);
  addDetails(wb, rows);
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Laporan_Keuangan_${monthName}_${year}.xlsx`,
  );
}
