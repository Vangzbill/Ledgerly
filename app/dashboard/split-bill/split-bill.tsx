"use client";
import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Save, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatIdr } from "@/lib/format";
import { todayJakarta } from "@/lib/periods";
import { computeBills, whatsappText, type PersonBill } from "@/lib/split-bill";
import type { ExtractedReceipt } from "@/lib/receipt-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItemAssigner } from "./item-assigner";
import { initialSplitState, splitReducer } from "./state";

interface SplitBillProps {
  receipt: ExtractedReceipt;
  receiptPath: string;
}

export function SplitBill({ receipt, receiptPath }: SplitBillProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(splitReducer, initialSplitState);
  const [name, setName] = useState("");
  const [savingFor, setSavingFor] = useState<number | null>(null);
  const { people, assignments, meId } = state;
  const { bills, unassigned } = computeBills(receipt, people, assignments);
  const meItems = people.map((p) => ({ value: String(p.id), label: p.name }));

  function addPerson(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "addPerson", name });
    setName("");
  }

  function shareWhatsApp(bill: PersonBill) {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText(bill))}`, "_blank", "noopener");
  }

  // stores only the signed-in user's own grand total, never the whole bill
  async function saveMyPortion(bill: PersonBill) {
    setSavingFor(bill.person.id);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? receipt.date : todayJakarta();
    const { error } = await createClient().from("transactions").insert({
      merchant: receipt.merchant || "Split Bill",
      amount: bill.total,
      date,
      category: "Food",
      type: "expense",
      receipt_path: receiptPath || null,
    });
    setSavingFor(null);
    if (error) return toast.error(error.message);
    toast.success(`Porsi kamu (${formatIdr(bill.total)}) tersimpan`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="people-heading" className="grid gap-3">
        <h2 id="people-heading" className="font-serif text-2xl">1. Siapa saja yang ikut?</h2>
        <form onSubmit={addPerson} className="flex gap-2">
          <Input aria-label="Nama orang" placeholder="Nama, mis. Budi" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={!name.trim()} className="bg-emerald-800 hover:bg-emerald-900"><UserPlus /> Add Person</Button>
        </form>
        {people.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {people.map((p) => (
              <span key={p.id} className="flex items-center gap-1 rounded-full bg-stone-200 py-1 pl-3 pr-1 text-sm">
                {p.name}
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Hapus ${p.name}`} onClick={() => dispatch({ type: "removePerson", id: p.id })}><X /></Button>
              </span>
            ))}
            <div className="ml-auto flex items-center gap-2 text-sm text-stone-600">
              Saya adalah
              <Select items={meItems} value={meId === null ? null : String(meId)} onValueChange={(v) => dispatch({ type: "setMe", id: v ? Number(v) : null })}>
                <SelectTrigger aria-label="Saya adalah" className="w-36 bg-white"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{meItems.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="items-heading" className="grid gap-3">
        <h2 id="items-heading" className="font-serif text-2xl">2. Siapa makan apa?</h2>
        <ul className="grid gap-2">
          {receipt.items.map((_, i) => (
            <ItemAssigner key={i} receipt={receipt} index={i} people={people} assignments={assignments} dispatch={dispatch} />
          ))}
        </ul>
        <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-6 text-sm tabular-nums">
          <dt className="text-stone-500">Subtotal</dt><dd className="text-right">{formatIdr(receipt.subtotal)}</dd>
          <dt className="text-stone-500">Pajak & layanan</dt><dd className="text-right">{formatIdr(receipt.tax)}</dd>
          <dt className="font-medium">Total struk</dt><dd className="text-right font-medium">{formatIdr(receipt.total)}</dd>
        </dl>
      </section>

      <section aria-labelledby="bills-heading" className="grid gap-3">
        <h2 id="bills-heading" className="font-serif text-2xl">3. Tagihan masing-masing</h2>
        {people.length === 0 && <p className="text-stone-500">Belum ada orang. Tambahkan nama di langkah 1.</p>}
        {unassigned > 0 && people.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            Masih ada menu senilai {formatIdr(unassigned)} (belum termasuk pajak) yang belum dibagi.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {bills.map((bill) => (
            <Card key={bill.person.id}>
              <CardHeader><CardTitle className="font-serif text-xl">{bill.person.name}{bill.person.id === meId && <span className="ml-2 text-sm font-normal text-emerald-800">(saya)</span>}</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {bill.lines.length === 0 ? (
                  <p className="text-sm text-stone-500">Belum ada menu.</p>
                ) : (
                  <ul className="grid gap-1 text-sm">
                    {bill.lines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-2 tabular-nums">
                        <span>{l.units === 1 ? l.name : `${Math.round(l.units * 100) / 100}× ${l.name}`}</span>
                        <span>{formatIdr(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-stone-200 pt-2 text-sm tabular-nums">
                  <dt className="text-stone-500">Subtotal</dt><dd className="text-right">{formatIdr(bill.subtotal)}</dd>
                  <dt className="text-stone-500">Pajak & layanan</dt><dd className="text-right">{formatIdr(bill.tax)}</dd>
                  <dt className="font-medium">Grand total</dt><dd className="text-right font-serif text-xl">{formatIdr(bill.total)}</dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={bill.lines.length === 0} onClick={() => shareWhatsApp(bill)}>
                    <MessageCircle /> Share to WhatsApp
                  </Button>
                  {bill.person.id === meId && (
                    <Button type="button" size="sm" className="bg-emerald-800 hover:bg-emerald-900" disabled={bill.total <= 0 || savingFor !== null} onClick={() => saveMyPortion(bill)}>
                      {savingFor === bill.person.id ? <Loader2 className="animate-spin" /> : <Save />} Save My Portion
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {people.length > 0 && meId === null && <p className="text-sm text-stone-500">Pilih &quot;Saya adalah&quot; di langkah 1 untuk menyimpan porsi kamu.</p>}
      </section>
    </div>
  );
}
