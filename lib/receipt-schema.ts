import { z } from "zod";

/** What the LLM must return for a receipt. `tax` is everything between subtotal and total (tax + service - discounts). */
export const extractedReceiptSchema = z.object({
  merchant: z.string().default(""),
  date: z.string().default(""),
  items: z
    .array(z.object({ qty: z.number().int().positive(), name: z.string().trim().min(1), total_price: z.number().nonnegative() }))
    .min(1),
  subtotal: z.number().nonnegative(),
  tax: z.number(),
  total: z.number().nonnegative(),
});

export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>;

/** Fill in what the model left at 0 so `subtotal + tax = total` holds and splitting has a usable base. */
export function normalizeReceipt(r: ExtractedReceipt): ExtractedReceipt {
  const itemsSum = r.items.reduce((s, i) => s + i.total_price, 0);
  const subtotal = r.subtotal > 0 ? r.subtotal : itemsSum;
  const total = r.total > 0 ? r.total : subtotal + r.tax;
  const tax = r.tax === 0 && total !== subtotal ? total - subtotal : r.tax;
  return { ...r, subtotal, tax, total };
}
