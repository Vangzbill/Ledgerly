import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import Image from "next/image";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

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
    <html lang="en" className={`${serif.variable} ${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Before paint, to avoid a flash: saved choice wins, otherwise follow the OS. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <header className="border-b border-border/70 bg-background/90 backdrop-blur sticky top-0 z-20">
          <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Image src="/logo.jpg" alt="" width={28} height={28} className="rounded" priority /> Ledgerly
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {user ? (
                <>
                  <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>Dashboard</Link>
                  <form action={signOut}><Button type="submit" size="sm" variant="outline">Sign out</Button></form>
                </>
              ) : (
                <Link href="/login" className={buttonVariants({ size: "sm" })}>Sign in</Link>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
