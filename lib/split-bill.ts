import type { ExtractedReceipt } from "./receipt-schema";
import { formatIdr } from "./format";

export interface Person {
  id: number;
  name: string;
}

/** item index -> person id -> units of that item (can be fractional when shared) */
export type Assignments = Record<number, Record<number, number>>;

export interface BillLine {
  name: string;
  units: number;
  amount: number;
}

export interface PersonBill {
  person: Person;
  lines: BillLine[];
  subtotal: number;
  tax: number;
  total: number;
}

const EPSILON = 0.005;

export const unitsAssigned = (assignments: Assignments, item: number): number =>
  Object.values(assignments[item] ?? {}).reduce((s, u) => s + u, 0);

export const unitsLeft = (receipt: ExtractedReceipt, assignments: Assignments, item: number): number =>
  Math.max(0, receipt.items[item].qty - unitsAssigned(assignments, item));

export const roundUnits = (n: number): number => Math.round(n * 100) / 100;

/**
 * Each person pays the price of what they ate plus a proportional share of tax/service:
 *   tax share = (person subtotal / receipt subtotal) * receipt tax
 * Whatever is not assigned yet is reported as `unassigned` (its subtotal), so nothing silently disappears.
 */
export function computeBills(
  receipt: ExtractedReceipt,
  people: Person[],
  assignments: Assignments,
): { bills: PersonBill[]; unassigned: number } {
  const base = receipt.subtotal > 0 ? receipt.subtotal : receipt.items.reduce((s, i) => s + i.total_price, 0);

  const bills = people.map((person) => {
    const lines: BillLine[] = [];
    receipt.items.forEach((item, i) => {
      const units = assignments[i]?.[person.id] ?? 0;
      if (units > EPSILON) lines.push({ name: item.name, units, amount: (item.total_price / item.qty) * units });
    });
    const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0));
    const tax = base > 0 ? Math.round((subtotal / base) * receipt.tax) : 0;
    return { person, lines, subtotal, tax, total: subtotal + tax };
  });

  const unassigned = Math.round(
    receipt.items.reduce((s, item, i) => s + (item.total_price / item.qty) * unitsLeft(receipt, assignments, i), 0),
  );
  return { bills, unassigned: unassigned < 1 ? 0 : unassigned };
}

const unitsLabel = (n: number) => String(roundUnits(n));

export function whatsappText(bill: PersonBill): string {
  const menu = bill.lines.map((l) => (l.units === 1 ? l.name : `${unitsLabel(l.units)}x ${l.name}`)).join(", ");
  return `Halo ${bill.person.name}, tagihan kamu: ${menu}. Total + Pajak: ${formatIdr(bill.total)}.`;
}

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("split-bill.ts")) {
  const receipt: ExtractedReceipt = {
    merchant: "", date: "",
    items: [
      { qty: 2, name: "Katsu", total_price: 78000 },
      { qty: 1, name: "Saikoro", total_price: 40000 },
    ],
    subtotal: 118000, tax: 11800, total: 129800,
  };
  const people = [{ id: 1, name: "Budi" }, { id: 2, name: "Ani" }];
  // Budi: 1 Katsu (39.000); Ani: 1 Katsu + Saikoro (79.000)
  const { bills, unassigned } = computeBills(receipt, people, { 0: { 1: 1, 2: 1 }, 1: { 2: 1 } });
  const got = bills.map((b) => `${b.person.name}:${b.subtotal}+${b.tax}=${b.total}`).join(" ");
  if (got !== "Budi:39000+3900=42900 Ani:79000+7900=86900" || unassigned !== 0) throw new Error(`split: ${got} / ${unassigned}`);
  // an unassigned item stays visible instead of vanishing
  const partial = computeBills(receipt, people, { 0: { 1: 2 } });
  if (partial.unassigned !== 40000 || partial.bills[0].total !== 85800) throw new Error(`partial: ${partial.unassigned}`);
  if (!whatsappText(bills[1]).startsWith("Halo Ani, tagihan kamu: Katsu, Saikoro. Total + Pajak: Rp")) throw new Error("whatsapp");
  console.log("split-bill ok");
}
