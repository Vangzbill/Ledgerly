"use client";
import { Minus, Plus, Users } from "lucide-react";
import { formatIdr } from "@/lib/format";
import { roundUnits, unitsAssigned, unitsLeft, type Assignments, type Person } from "@/lib/split-bill";
import type { ExtractedReceipt } from "@/lib/receipt-schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SplitAction } from "./state";

interface ItemAssignerProps {
  receipt: ExtractedReceipt;
  index: number;
  people: Person[];
  assignments: Assignments;
  dispatch: (action: SplitAction) => void;
}

const NONE = "none";
const EVERYONE = "everyone";

export function ItemAssigner({ receipt, index, people, assignments, dispatch }: ItemAssignerProps) {
  const item = receipt.items[index];
  const left = unitsLeft(receipt, assignments, index);
  const mine = assignments[index] ?? {};

  // single-qty items use a dropdown: who ate it?
  const eaters = people.filter((p) => (mine[p.id] ?? 0) > 0);
  const singleValue = eaters.length === 0 ? NONE : eaters.length === 1 ? String(eaters[0].id) : EVERYONE;
  const singleItems = [
    { value: NONE, label: "Belum dipilih" },
    ...people.map((p) => ({ value: String(p.id), label: p.name })),
    ...(people.length > 1 ? [{ value: EVERYONE, label: "Semua (bagi rata)" }] : []),
  ];

  function onSinglePick(value: string | null) {
    if (value === EVERYONE) return dispatch({ type: "splitEvenly", item: index, qty: item.qty });
    dispatch({ type: "assignOne", item: index, person: !value || value === NONE ? null : Number(value) });
  }

  return (
    <li className="rounded-lg border border-stone-300 bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{item.qty}× {item.name}</p>
        <p className="tabular-nums text-sm text-stone-600">
          {formatIdr(item.total_price)}{item.qty > 1 && <span className="text-stone-400"> ({formatIdr(item.total_price / item.qty)} / porsi)</span>}
        </p>
      </div>

      {people.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Tambahkan orang dulu untuk membagi menu ini.</p>
      ) : item.qty === 1 ? (
        <div className="mt-2">
          <Select items={singleItems} value={singleValue} onValueChange={onSinglePick}>
            <SelectTrigger aria-label={`Siapa yang makan ${item.name}`} className="w-full bg-white sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{singleItems.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : (
        <div className="mt-2 grid gap-2">
          <ul className="flex flex-wrap gap-2">
            {people.map((p) => {
              const units = mine[p.id] ?? 0;
              const max = units + left;
              return (
                <li key={p.id} className="flex items-center gap-1 rounded-full border border-stone-300 py-1 pl-3 pr-1 text-sm">
                  <span>{p.name}</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Kurangi ${p.name}`} disabled={units <= 0}
                    onClick={() => dispatch({ type: "setUnits", item: index, person: p.id, units: units - 1, max })}><Minus /></Button>
                  <span className="min-w-6 text-center tabular-nums">{roundUnits(units)}</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Tambah ${p.name}`} disabled={left < 0.005}
                    onClick={() => dispatch({ type: "setUnits", item: index, person: p.id, units: units + 1, max })}><Plus /></Button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button type="button" variant="outline" size="sm" disabled={people.length < 2} onClick={() => dispatch({ type: "splitEvenly", item: index, qty: item.qty })}>
              <Users /> Bagi rata
            </Button>
            <span className={left < 0.005 ? "text-emerald-700" : "text-amber-700"}>
              {left < 0.005 ? "Semua porsi sudah dibagi" : `Sisa ${roundUnits(left)} dari ${item.qty} porsi`}
            </span>
          </div>
        </div>
      )}
      {people.length > 0 && item.qty === 1 && unitsAssigned(assignments, index) < 0.005 && (
        <p className="mt-1 text-xs text-amber-700">Belum ada yang dipilih</p>
      )}
    </li>
  );
}
