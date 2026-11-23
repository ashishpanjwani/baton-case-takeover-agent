import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baton · Case takeover agent",
  description: "Investigates reassigned personal injury cases and prepares an evidence-backed takeover report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-[14px] font-semibold text-white">B</span>
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-semibold tracking-tight">Baton</span>
                <span className="text-[11px] text-ink-3">Case takeover agent</span>
              </span>
            </Link>
            <div className="flex items-center gap-5 text-[13px]">
              <Link href="/connections" className="font-medium text-ink-2 hover:text-accent">Connections</Link>
              <span className="hidden text-ink-3 sm:block">Calder &amp; Wynn Injury Law · <span className="italic">fictional demo firm</span></span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
