export type ParsedReceipt = { merchant: string; amount: string; date: string; category: string; type: "income" | "expense" };

const MONTHS = ["jan", "feb", "mar", "apr", "mei|may", "jun", "jul", "agu|aug", "sep", "okt|oct", "nov", "des|dec"];
export const NUM = String.raw`\d{1,3}(?:[., ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const TOTAL_KEY = /(grand\s*)?total|jumlah|\bamount\b|balance|tagihan|bayar|nominal|top\s*-?\s*up/i;
const NOT_TOTAL = /sub\s*-?\s*total|kembali|change|tax|pajak|ppn|pb1|diskon|discount|admin|fee|biaya|service|servis|rounding|pembulatan|saldo/i;
const SKIP_MERCHANT = /^(struk|receipt|invoice|faktur|nota|tel|telp|phone|npwp|jl\.?|jalan|www|http|kasir|cashier|no\b|transfer successful)/i;
const CHAINS = /(indomaret|alfamart|alfamidi|hypermart|superindo|giant|lawson|familymart|circle\s*k)/i;
const WALLETS = /\b(gopay|ovo|dana|shopee\s*pay|linkaja|flip|jenius|blu|e-?money|flazz|brizzi|tapcash)\b/i;
const CATEGORIES: [RegExp, string][] = [
  [/resto|restaurant|cafe|kopi|coffee|bakery|warung|bakso|\bmie\b|ayam|nasi|pizza|burger|sushi|kfc|mcd|food|dine|takeaway|makan/i, "Food"],
  [/indomaret|alfamart|alfamidi|supermarket|hypermart|\bmart\b|grocer/i, "Groceries"],
  [/pertamina|shell|bensin|parkir|parking|grab|gojek|\btol\b/i, "Transport"],
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

const numbersIn = (line: string) => (line.match(new RegExp(NUM, "g")) ?? []).map(toNumber).filter((n) => n > 0);

function findAmount(lines: string[]): string {

  for (let i = lines.length - 1; i >= 0; i--) {
    if (!TOTAL_KEY.test(lines[i]) || NOT_TOTAL.test(lines[i])) continue;
    const nums = numbersIn(lines[i]).length ? numbersIn(lines[i]) : numbersIn(lines[i + 1] ?? "");
    if (nums.length) return String(nums[nums.length - 1]);
  }

  const text = lines.join("\n");
  const cur = [...text.matchAll(new RegExp(String.raw`(?:idr|rp\.?|\$)\s*(${NUM})`, "gi"))].map((m) => toNumber(m[1]));
  if (cur.length) return String(Math.max(...cur));
  const dec = [...text.matchAll(/\d+[.,]\d{2}\b/g)].map((m) => toNumber(m[0]));
  return dec.length ? String(Math.max(...dec)) : "";
}

const pad = (n: string | number) => String(n).padStart(2, "0");

export function findDate(text: string): string {
  let m = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/);
  if (m) {
    const [d, mo] = Number(m[2]) > 12 ? [m[2], m[1]] : [m[1], m[2]];
    return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(mo)}-${pad(d)}`;
  }
  m = text.match(new RegExp(String.raw`(\d{1,2})\s+(${MONTHS.join("|")})[a-z]*\.?,?\s+(\d{4})`, "i"));
  if (m) {
    const idx = MONTHS.findIndex((x) => new RegExp(`^(${x})$`, "i").test(m![2]));
    return `${m[3]}-${pad(idx + 1)}-${pad(m[1])}`;
  }
  return "";
}

function findMerchant(lines: string[], isTransfer: boolean): string {
  if (isTransfer) {
    const i = lines.findIndex((l) => /beneficiary\s*name|nama\s*penerima|penerima|recipient/i.test(l));
    if (i >= 0) {
      const same = lines[i].replace(/.*?(beneficiary\s*name|nama\s*penerima|penerima|recipient)\s*:?/i, "").trim();
      return same || (lines[i + 1] ?? "");
    }
  }
  return lines.find((l) => /[a-z]{3}/i.test(l) && !SKIP_MERCHANT.test(l)) ?? "";
}

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isTopUp = /top\s*-?\s*up|isi\s*saldo/i.test(text);
  const isTransfer = !isTopUp && /transfer|beneficiary|penerima/i.test(text);
  const merchant = isTopUp ? (text.match(WALLETS)?.[1].toUpperCase() ?? "Top Up") : (text.match(CHAINS)?.[1].replace(/^./, (c) => c.toUpperCase()) ?? findMerchant(lines, isTransfer));
  const category = isTopUp ? "Top Up" : isTransfer ? "Transfer" : (CATEGORIES.find(([re]) => re.test(text))?.[1] ?? "");
  const type = /received|diterima|dana\s*masuk|incoming|terima\s*dari|gaji|salary|refund/i.test(text) ? "income" : "expense";
  return { merchant, amount: findAmount(lines), date: findDate(text), category, type };
}

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("parse-receipt.ts")) {
  const check = (name: string, r: ParsedReceipt, want: string) => {
    const got = `${r.merchant}|${r.amount}|${r.date}|${r.category}`;
    if (got !== want) throw new Error(`${name}: got ${got}, want ${want}`);
  };
  check("bca", parseReceipt("BCA\nTransfer Successful\n26 Sep 2026 07:40:56\nIDR 38,500.00\nBeneficiary Name\nCATHERINE ANTONI\nBeneficiary Account\n605 - 058 - 9984"), "CATHERINE ANTONI|38500|2026-09-26|Transfer");
  check("us", parseReceipt("ACME MART\nSubtotal 10.00\nTax 1.50\nTOTAL $11.50\n2026-03-04"), "ACME MART|11.5|2026-03-04|Groceries");
  check("indomaret", parseReceipt("INDOMARET\nJl. Merdeka 5\nSubtotal 45.000\nPPN 4.500\nTOTAL BAYAR Rp 49.500\nTunai 50.000\nKembali 500\n04/03/2026 18:22"), "INDOMARET|49500|2026-03-04|Groceries");
  check("topup", parseReceipt("GoPay\nTop Up Berhasil\nNominal Top Up\nRp 100.000\nBiaya Admin Rp 1.000\nTotal Pembayaran Rp 101.000\n12 Mei 2026 10:15"), "GOPAY|101000|2026-05-12|Top Up");
  check("food", parseReceipt("Warung Nasi Bu Tini\n1x Nasi Goreng 25.000\n2x Es Teh 10.000\nSubtotal 45.000\nService 5% 2.250\nPB1 10% 4.725\nGrand Total 51.975\nTanggal 03-04-2026"), "Warung Nasi Bu Tini|51975|2026-04-03|Food");
  if (parseReceipt("Transfer received\nRp 500.000").type !== "income") throw new Error("income detection");
  // tax-inclusive: take the final paid total, not subtotal / DPP / harga jual
  check("indomaret-photo", parseReceipt("TEBET BARAT DALAM
JL.TEBET BARAT NO.B6
02.10.26 -09: 55 / 4.5.0 / TK29 - 9359
BROOKFARM MATCHA 200 1 8500 8, 500
VOUCHER : (2, 600)
TOTAL BELANJA : 5, 900
NON TUNAI : 5, 900
ANDA HEMAT : 2, 500
PPN : DPP = 7,020 PPN = 842
HARGA JUAL : 7, 656
KONTAK@INDOMARET.CO.ID"), "Indomaret | 5900 | 2026 - 10-02 | Groceries");
  check("cafe-photo", parseReceipt("Matchasan BGM
Waktu Penjualan
28 Sep 2026 13 22
Q No A007(DINE - IN)
54 000 x1
Subtotal 54.000
Biaya Layanan 5 % 2.700
PB 1 10 % 5.670
Pembulatan - 70
Grand Total Rp 62 300
QRIS Rp 62 300"), "Matchasan BGM | 62300 | 2026 -09 - 28 | Food");
  console.log("parse-receipt ok");
}

export const guessCategory = (text: string): string => CATEGORIES.find(([re]) => re.test(text))?.[1] ?? "";
