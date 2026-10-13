import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav, NavLinks } from "@/components/nav";
import { IntegrityBanner } from "@/components/integrity-banner";
import { Shortcuts } from "@/components/shortcuts";
import { TabBar, TabBarLinks } from "@/components/tab-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "PIEGL Study Agency",
  description: "Private study workspace for ZJU PIEGL.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="mx-auto flex max-w-6xl flex-col md:flex-row md:gap-8 md:px-6">
          <header className="flex items-center justify-between px-4 pb-2 pt-5 md:hidden">
            <p className="text-lg font-semibold">PIEGL Study Agency</p>
          </header>
          <aside className="hidden md:block md:w-56 md:shrink-0 md:py-8">
            <div className="sticky top-8 rounded-[24px] bg-surface p-4 shadow-soft">
              <p className="mb-4 px-2 text-base font-semibold leading-tight">PIEGL Study Agency</p>
              <Suspense fallback={<NavLinks pathname="" />}>
                <Nav />
              </Suspense>
              <p className="mt-6 px-2 text-xs text-ink-muted">
                Press <kbd className="rounded border border-line px-1 font-mono">?</kbd> for shortcuts
              </p>
            </div>
          </aside>
          <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-2 md:px-0 md:py-8">
            <IntegrityBanner />
            {children}
          </main>
        </div>
        <Suspense fallback={<TabBarLinks pathname="" />}>
          <TabBar />
        </Suspense>
        <Shortcuts />
      </body>
    </html>
  );
}
