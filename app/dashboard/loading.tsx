export default function Loading() {
  return (
    <section className="mx-auto max-w-5xl animate-pulse px-4 py-8" role="status" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="h-32 rounded-xl bg-stone-300" />
        <div className="h-32 rounded-xl bg-stone-200" />
      </div>
      <div className="mt-4 h-9 w-72 rounded bg-stone-200" />
      <div className="mt-4 h-64 rounded-lg bg-stone-200" />
    </section>
  );
}
