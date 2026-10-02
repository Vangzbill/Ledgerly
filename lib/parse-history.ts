import { NUM, toNumber, findDate, guessCategory, type ParsedReceipt } from "./parse-receipt";

const DATE_LINE = /\d{1,2}\s+[a-z]{3,9}\.?\s+\d{4}\s*,?\s*\d{1,2}[:.]\d{2}/i;
const TYPE_WORD = /^(pembayaran|transfer|bunga|top\s*-?\s*up|tarik\s*tunai|setor\s*tunai|pajak|biaya|cashback|payment|interest)$/i;
const TYPE_CATEGORY: [RegExp, string][] = [[/transfer/i, "Transfer"], [/bunga|interest/i, "Interest"], [/top/i, "Top Up"], [/pajak/i, "Tax"]];

export function parseHistory(text: string): ParsedReceipt[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const anchors = lines.flatMap((l, i) => (DATE_LINE.test(l) ? [i] : []));
  if (anchors.length < 2) return [];
  const amounts = [...text.matchAll(new RegExp(String.raw`([+\-−–—])?\s*Rp\.?\s*(${NUM})`, "gi"))];

  return anchors.map((a, i) => {
    const prev = lines[a - 1] ?? "";
    const hasType = TYPE_WORD.test(prev);
    const merchant = hasType ? (lines[a - 2] ?? "") : prev;
    const amt = amounts[i];
    return {
      merchant,
      amount: amt ? String(toNumber(amt[2])) : "",
      date: findDate(lines[a]),
      category: (hasType && TYPE_CATEGORY.find(([re]) => re.test(prev))?.[1]) || guessCategory(merchant),
      type: amt?.[1] === "+" ? "income" : "expense",
    };
  });
}

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("parse-history.ts")) {
  const rows = parseHistory(
    "Jago Coffee\nPembayaran\n02 Okt 2026, 12:53\n-Rp 8.000\nBunga Tabungan\nBunga\n02 Okt 2026, 01:26\n+Rp 87\nNadhila Shafaresta\nTransfer\n01 Okt 2026, 16:26\n+Rp 27.000",
  );
  const got = rows.map((r) => `${r.merchant}|${r.amount}|${r.date}|${r.category}|${r.type}`).join(";");
  const want = "Jago Coffee|8000|2026-10-02|Food|expense;Bunga Tabungan|87|2026-10-02|Interest|income;Nadhila Shafaresta|27000|2026-10-01|Transfer|income";
  if (got !== want) throw new Error(`history: got ${got}`);
  console.log("parse-history ok");
}
