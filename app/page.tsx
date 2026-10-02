import Link from "next/link";
import { Camera, FileSpreadsheet, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const steps = [
  { icon: Camera, title: "Snap", text: "Photograph a receipt. OCR reads merchant, total and date." },
  { icon: FileSpreadsheet, title: "Track", text: "Review, save, and export everything to Excel in one click." },
  { icon: MessageCircle, title: "Share", text: "Send this month's summary to your partner on WhatsApp." },
];

export default function Home() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <p className="mb-4 text-sm uppercase tracking-[0.2em] text-emerald-800">Shared household ledger</p>
      <h1 className="font-serif text-5xl leading-[1.05] sm:text-7xl">
        Receipts in.<br /><span className="italic text-emerald-800">Records out.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-stone-600">
        A free, private expense tracker. Each person only ever sees their own transactions.
      </p>
      <Link href="/dashboard/add" className={buttonVariants({ size: "lg" }) + " mt-8 bg-emerald-800 hover:bg-emerald-900"}>
        Add your first receipt
      </Link>
      <ol className="mt-20 grid gap-6 sm:grid-cols-3">
        {steps.map(({ icon: I, title, text }, i) => (
          <li key={title} className={`border-t-2 border-stone-900 pt-4 ${i === 1 ? "sm:mt-8" : i === 2 ? "sm:mt-16" : ""}`}>
            <I className="mb-3 size-6 text-emerald-800" />
            <h2 className="font-serif text-2xl">{title}</h2>
            <p className="mt-1 text-stone-600">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
