export type ParsedReceipt = { merchant: string; amount: string; date: string; category: string; type: "income" | "expense" };

const MONTHS = ["jan", "feb", "mar", "apr", "mei|may", "jun", "jul", "agu|aug", "sep", "okt|oct", "nov", "des|dec"];
const MONTH_RE = MONTHS.join("|");
export const NUM = String.raw`\d{1,3}(?:[., ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const STRICT_NUM = String.raw`\d{1,3}(?:[., ]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}`;

// Amount tiers, strongest first. The final paid amount already includes tax/service, so
// lines that are pre-tax or part of the breakdown are excluded.
const STRONG_TOTAL = /grand\s*total|total\s*(bayar|pembayaran|tagihan|belanja|akhir|due|payment|amount)|amount\s*due|balance\s*due|jumlah\s*(bayar|tagihan|total)|net\s*total|total\s*harga/i;
const PLAIN_TOTAL = /total|jumlah|\bamount\b|tagihan|nominal|top\s*-?\s*up/i;
const PAID_VIA = /qris|non\s*-?\s*tunai|debit|credit|kartu|\bcard\b|visa|master\s*card|gopay|ovo|\bdana\b|shopee|linkaja|e-?wallet/i;
const NOT_TOTAL = /sub\s*-?\s*total|kembali|change|tendered|tax|pajak|ppn|pb\s*-?\s*1|dpp|diskon|discount|hemat|saving|voucher|promo|admin|fee|biaya|service|servis|\btip\b|rounding|pembulatan|saldo|item|qty|quantity|\bpcs\b|poin|point/i;

const SKIP_MERCHANT = /^(struk|receipt|invoice|faktur|nota|bill|check|tel|telp|phone|npwp|jl\.?|jalan|www|http|kasir|cashier|waktu|tanggal|date|time|pelanggan|customer|meja|table|order|antrian|q\s*no|no\b|powered|welcome|selamat|terima\s*kasih|thank|transfer successful)/i;
const CHAINS = /\b(indomaret|alfamart|alfamidi|hypermart|superindo|giant|lawson|familymart|circle\s*k)\b/i;
const WALLETS = /\b(gopay|ovo|dana|shopee\s*pay|linkaja|flip|jenius|blu|e-?money|flazz|brizzi|tapcash)\b/i;

// order matters: first match wins
const CATEGORIES: [RegExp, string][] = [
  [/indomaret|alfamart|alfamidi|supermarket|hypermart|superindo|\bmart\b|grocer/i, "Groceries"],
  [/pertamina|\bshell\b|bensin|parkir|parking|grab|gojek|\btol\b/i, "Transport"],
  [
    // cafe/restaurant by name or menu words, or by receipt traits only restaurants print (PB1, service charge, dine-in)
    /resto|restaurant|cafe|kopi|coffee|bakery|warung|warteg|kantin|kitchen|bistro|grill|eatery|bar\b|bakso|\bmie\b|mi\s*ayam|ayam|nasi|sate|soto|geprek|kebab|ramen|sushi|steak|pizza|burger|chicken|noodle|dimsum|boba|latte|espresso|matcha|\bteh\b|\btea\b|juice|\bjus\b|roti|donut|dessert|ice\s*cream|kfc|mcd|food|makan|dine|take\s*-?\s*away|pb\s*-?\s*1|service\s*charge|biaya\s*layanan/i,
    "Food",
  ],
];

// "1,234.56" "1.234,56" "38.500" "38,500.00" "11.50" -> number
export function toNumber(s: string): number {
  s = s.replace(/ /g, ""); // OCR often reads "62 300" for 62.300
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (last === -1) return Number(s);
  const decimals = s.length - last - 1;
  if (decimals === 3) return Number(s.replace(/[.,]/g, "")); // "38.500" is thousands (IDR)
  return Number(s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1));
}

function numbersIn(line: string, strict = false): number[] {
  const noPercent = line.replace(/\d+(?:[.,]\d+)?\s*%/g, " "); // "service 5%" is not an amount
  return (noPercent.match(new RegExp(strict ? STRICT_NUM : NUM, "g")) ?? []).map(toNumber).filter((n) => n > 0);
}

// last line (bottom-up) in `tier` that carries a number, falling back to the number on the next line
function lastAmountIn(lines: string[], tier: RegExp, strict = false): number | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!tier.test(lines[i]) || NOT_TOTAL.test(lines[i])) continue;
    const nums = numbersIn(lines[i], strict);
    const found = nums.length ? nums : numbersIn(lines[i + 1] ?? "", strict);
    if (found.length) return found[found.length - 1];
  }
  return undefined;
}

// last number on the last line matching `re` (no next-line fallback), skipping lines matching `skip`
function lastOnLine(lines: string[], re: RegExp, skip?: RegExp): number | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!re.test(lines[i]) || skip?.test(lines[i])) continue;
    const nums = numbersIn(lines[i]);
    if (nums.length) return nums[nums.length - 1];
  }
  return undefined;
}

const EXTRA = /pajak|tax|ppn|pb\s*-?\s*1|service|servis|biaya\s*layanan|admin|ongkir|delivery/i;
const DEDUCT = /diskon|discount|voucher|promo|potongan/i;
const ROUNDING = /pembulatan|rounding/i;

// Two independent derivations of the paid total, used to catch OCR digit errors:
//   subtotal + taxes/fees - discounts (+/- rounding), and cash tendered - change.
function derivedTotals(lines: string[]): number[] {
  const out: number[] = [];
  const subIdx = lines.findLastIndex((l) => /sub\s*-?\s*total/i.test(l) && numbersIn(l).length);
  if (subIdx >= 0) {
    let t = numbersIn(lines[subIdx]).at(-1)!;
    for (const l of lines.slice(subIdx + 1)) {
      const n = numbersIn(l).at(-1);
      if (n === undefined || /total|tunai|cash|kembali|change|tendered/i.test(l)) continue;
      if (EXTRA.test(l)) t += n;
      else if (DEDUCT.test(l)) t -= n;
      else if (ROUNDING.test(l)) t += /[-(−]/.test(l) ? -n : n;
    }
    out.push(t);
  }
  const tendered = lastOnLine(lines, /tunai|cash|tendered|dibayar/i, /total|kembali|change|non\s*-?\s*tunai/i);
  const change = lastOnLine(lines, /kembali|change/i);
  if (tendered !== undefined && change !== undefined && tendered > change) out.push(tendered - change);
  return out;
}

function pickAmount(lines: string[]): { amount?: number; verified: boolean } {
  const labelled = lastAmountIn(lines, STRONG_TOTAL) ?? lastAmountIn(lines, PLAIN_TOTAL) ?? lastAmountIn(lines, PAID_VIA, true);
  const derived = derivedTotals(lines);
  if (labelled !== undefined && derived.includes(labelled)) return { amount: labelled, verified: true };
  // the printed total disagrees with the arithmetic: trust it only if no two derivations agree with each other
  const agreed = derived.find((d, i) => derived.indexOf(d) !== i);
  if (agreed !== undefined) return { amount: agreed, verified: true };
  if (labelled === undefined && derived.length) return { amount: derived[0], verified: false };
  return { amount: labelled, verified: false };
}

/** true when the amount was cross-checked against subtotal+tax or tendered-change */
export const isVerified = (text: string): boolean => pickAmount(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)).verified;

function findAmount(lines: string[]): string {
  const hit = pickAmount(lines).amount;
  if (hit !== undefined) return String(hit);
  // fallback: currency-prefixed amount (IDR / Rp / $), else the biggest number with decimals
  const text = lines.join("\n");
  const cur = [...text.matchAll(new RegExp(String.raw`(?:idr|rp\.?|\$)\s*(${NUM})`, "gi"))].map((m) => toNumber(m[1]));
  if (cur.length) return String(Math.max(...cur));
  const dec = [...text.matchAll(/\d+[.,]\d{2}\b/g)].map((m) => toNumber(m[0]));
  return dec.length ? String(Math.max(...dec)) : "";
}

const pad = (n: string | number) => String(n).padStart(2, "0");
const monthIndex = (name: string) => MONTHS.findIndex((x) => new RegExp(`^(${x})`, "i").test(name)) + 1;
const fullYear = (y: string) => (y.length === 2 ? "20" + y : y);

export function findDate(text: string): string {
  let m = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/); // ponytail: assumes dd/mm (Indonesia)
  if (m) {
    const [d, mo] = Number(m[2]) > 12 ? [m[2], m[1]] : [m[1], m[2]];
    return `${fullYear(m[3])}-${pad(mo)}-${pad(d)}`;
  }
  m = text.match(new RegExp(String.raw`\b(\d{1,2})[\s\-/.]*(${MONTH_RE})[a-z]*\.?,?[\s\-/.]*(\d{4}|\d{2})\b`, "i")); // 28 Sep 2026, 28-Sep-26
  if (m) return `${fullYear(m[3])}-${pad(monthIndex(m[2]))}-${pad(m[1])}`;
  m = text.match(new RegExp(String.raw`(${MONTH_RE})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})`, "i")); // Sep 28, 2026
  if (m) return `${m[3]}-${pad(monthIndex(m[1]))}-${pad(m[2])}`;
  return "";
}

const digitRatio = (l: string) => (l.match(/\d/g)?.length ?? 0) / l.length;

function findMerchant(lines: string[], isTransfer: boolean): string {
  if (isTransfer) {
    const i = lines.findIndex((l) => /beneficiary\s*name|nama\s*penerima|penerima|recipient/i.test(l));
    if (i >= 0) {
      const same = lines[i].replace(/.*?(beneficiary\s*name|nama\s*penerima|penerima|recipient)\s*:?/i, "").trim();
      return same || (lines[i + 1] ?? "");
    }
  }
  // first name-like line near the top: letters, not a label, not mostly digits, not a date/time
  return lines.slice(0, 8).find((l) => /[a-z]{3}/i.test(l) && !SKIP_MERCHANT.test(l) && digitRatio(l) < 0.3 && !findDate(l)) ?? "";
}

// ponytail: heuristic parser; swap for an LLM extraction if receipts get exotic
export function parseReceipt(text: string): ParsedReceipt {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isTopUp = /top\s*-?\s*up|isi\s*saldo/i.test(text);
  const isTransfer = !isTopUp && /transfer|beneficiary|penerima/i.test(text);
  const merchant = isTopUp
    ? (text.match(WALLETS)?.[1].toUpperCase() ?? "Top Up")
    : (text.match(CHAINS)?.[1].toLowerCase().replace(/^./, (c) => c.toUpperCase()) ?? findMerchant(lines, isTransfer));
  const category = isTopUp ? "Top Up" : isTransfer ? "Transfer" : guessCategory(text);
  const type = /received|diterima|dana\s*masuk|incoming|terima\s*dari|gaji|salary|refund/i.test(text) ? "income" : "expense";
  return { merchant, amount: findAmount(lines), date: findDate(text), category, type };
}

export const guessCategory = (text: string): string => CATEGORIES.find(([re]) => re.test(text))?.[1] ?? "";

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("parse-receipt.ts")) {
  const check = (name: string, text: string, want: string) => {
    const r = parseReceipt(text);
    const got = `${r.merchant}|${r.amount}|${r.date}|${r.category}`;
    if (got !== want) throw new Error(`${name}: got ${got}, want ${want}`);
  };
  check("bca", "BCA\nTransfer Successful\n26 Sep 2026 07:40:56\nIDR 38,500.00\nBeneficiary Name\nCATHERINE ANTONI\nBeneficiary Account\n605 - 058 - 9984", "CATHERINE ANTONI|38500|2026-09-26|Transfer");
  check("us", "ACME MART\nSubtotal 10.00\nTax 1.50\nTOTAL $11.50\n2026-03-04", "ACME MART|11.5|2026-03-04|Groceries");
  check("indomaret", "INDOMARET\nJl. Merdeka 5\nSubtotal 45.000\nPPN 4.500\nTOTAL BAYAR Rp 49.500\nTunai 50.000\nKembali 500\n04/03/2026 18:22", "Indomaret|49500|2026-03-04|Groceries");
  check("topup", "GoPay\nTop Up Berhasil\nNominal Top Up\nRp 100.000\nBiaya Admin Rp 1.000\nTotal Pembayaran Rp 101.000\n12 Mei 2026 10:15", "GOPAY|101000|2026-05-12|Top Up");
  check("warung", "Warung Nasi Bu Tini\n1x Nasi Goreng 25.000\n2x Es Teh 10.000\nSubtotal 45.000\nService 5% 2.250\nPB1 10% 4.725\nGrand Total 51.975\nTanggal 03-04-2026", "Warung Nasi Bu Tini|51975|2026-04-03|Food");
  check("indomaret-photo", "TEBET BARAT DALAM\nJL. TEBET BARAT NO. B6\n02.10.26-09:55/4.5.0/TK29-9359\nBROOKFARM MATCHA 200 1 8500 8,500\nVOUCHER : (2,600)\nTOTAL BELANJA : 5,900\nNON TUNAI : 5,900\nANDA HEMAT : 2,500\nPPN : DPP= 7,020 PPN= 842\nHARGA JUAL : 7,656\nKONTAK@INDOMARET.CO.ID", "Indomaret|5900|2026-10-02|Groceries");
  check("cafe-photo", "Matchasan BGM\nWaktu Penjualan\n28 Sep 2026 13 22\nQ No A007 (DINE-IN)\n54 000 x1\nSubtotal 54.000\nBiaya Layanan 5% 2.700\nPB 1 10% 5.670\nPembulatan -70\nGrand Total Rp 62 300\nQRIS Rp 62 300", "Matchasan BGM|62300|2026-09-28|Food");
  // generalisation: other layouts must still pick the final, tax-inclusive amount
  check("cash-change", "Kopi Tuku\nJl. Cipete Raya 12\nTable 5   Order #1182\nIced Latte 1x 32.000\nCroissant 1x 28.000\nSubtotal 60.000\nPB1 10% 6.000\nTOTAL 66.000\nCash 100.000\nChange 34.000\n12/09/2026 19:05", "Kopi Tuku|66000|2026-09-12|Food");
  check("total-item-line", "Sate Khas Senayan\nTotal Item 3\nSubtotal 120.000\nService Charge 5% 6.000\nPajak Restoran 10% 12.600\nTotal Tagihan Rp 138.600\n3 Oct 2026", "Sate Khas Senayan|138600|2026-10-03|Food");
  check("us-diner", "Joe's Diner\nBurger 12.00\nSubtotal 12.00\nTax 1.08\nTip 2.00\nTotal 15.08\nVisa **** 1234\nSep 28, 2026", "Joe's Diner|15.08|2026-09-28|Food");
  check("card-only", "Bakmi GM\nSubtotal 50.000\nPB1 5.000\nDebit BCA 55.000\n28-Sep-26", "Bakmi GM|55000|2026-09-28|Food");
  // OCR misread of the total (191,475 read as 131.47) is corrected by subtotal+tax and tendered-change agreeing
  check("misread-total", "Cafe Bee\nTanggal: 24-05-2023 16:45\nSubtotal 172,500\nPajak 18,975\nTotal 131.47\nTUNAI 200,000\nKembalian 8,525", "Cafe Bee|191475|2023-05-24|Food");
  if (!isVerified("Subtotal 172,500\nPajak 18,975\nTotal 191,475\nTUNAI 200,000\nKembalian 8,525")) throw new Error("verified");
  if (parseReceipt("Transfer received\nRp 500.000").type !== "income") throw new Error("income detection");
  console.log("parse-receipt ok");
}
