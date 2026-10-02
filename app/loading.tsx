import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-stone-500" role="status" aria-label="Loading">
      <Loader2 className="size-8 animate-spin text-emerald-800" />
    </div>
  );
}
