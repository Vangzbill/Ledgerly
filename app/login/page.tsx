"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const creds = { email: String(f.get("email")), password: String(f.get("password")) };
    setBusy(true);
    const auth = createClient().auth;
    const { data, error } = mode === "in" ? await auth.signInWithPassword(creds) : await auth.signUp({
      ...creds,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) return toast.success("Check your email to confirm your account.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{mode === "in" ? "Welcome back" : "Create account"}</CardTitle>
          <CardDescription>Your transactions stay private to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={6} required autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
            <Button type="submit" disabled={busy} className="bg-emerald-800 hover:bg-emerald-900">{busy ? <><Loader2 className="animate-spin" /> Please wait…</> : mode === "in" ? "Sign in" : "Sign up"}</Button>
            <button type="button" className="text-sm text-stone-600 underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
