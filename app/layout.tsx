import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import Image from "next/image";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import "./globals.css";

const serif = Fraunces({ variable: "--font-serif", subsets: ["latin"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ledgerly",
  description: "Snap a receipt, track your spending, share the report.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#faf7f2] text-stone-900 font-sans">
        <header className="border-b border-stone-300/70 bg-[#faf7f2]/90 backdrop-blur sticky top-0 z-20">
          <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Image src="/logo.jpg" alt="" width={28} height={28} className="rounded" priority /> Ledgerly
            </Link>
            {user ? (
              <div className="flex items-center gap-2">
                <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>Dashboard</Link>
                <form action={signOut}><Button type="submit" size="sm" variant="outline">Sign out</Button></form>
              </div>
            ) : (
              <Link href="/login" className={buttonVariants({ size: "sm" }) + " bg-emerald-800 hover:bg-emerald-900"}>Sign in</Link>
            )}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
