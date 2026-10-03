export const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const TIME_ZONE = "Asia/Jakarta";

/** current year and month (1-12) in the app's home timezone, so "this month" doesn't flip at 7am WIB */
export function currentPeriod(): { year: number; month: number } {
  const [year, month] = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE }).split("-").map(Number);
  return { year, month };
}

/** today as YYYY-MM-DD in the app's home timezone */
export const todayJakarta = (): string => new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

const pad = (n: number) => String(n).padStart(2, "0");

/** [start, nextStart) date strings for a month, usable as gte/lt bounds on a `date` column */
export function monthRange(year: number, month: number): [string, string] {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return [`${year}-${pad(month)}-01`, `${next.year}-${pad(next.month)}-01`];
}

/** parse ?month=&year= defensively; anything invalid falls back to the current period */
export function parsePeriod(rawMonth?: string | string[], rawYear?: string | string[]): { year: number; month: number } {
  const now = currentPeriod();
  const month = Number(Array.isArray(rawMonth) ? rawMonth[0] : rawMonth);
  const year = Number(Array.isArray(rawYear) ? rawYear[0] : rawYear);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.month,
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now.year,
  };
}
