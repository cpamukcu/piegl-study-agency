import type { Metadata, Viewport } from "next";
import Link from "next/link";
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

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  viewportFit: "cover",
};

function Wordmark() {
  return (
    <Link href="/today" className="flex items-baseline gap-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
      <span className="font-display text-lg font-extrabold tracking-tight text-ink">PIEGL</span>
      <span className="text-sm font-medium text-ink-muted">Study Agency</span>
    </Link>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans text-body antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lift"
        >
          Skip to content
        </a>
        <div className="mx-auto flex max-w-[1360px]">
          <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-line bg-white px-4 pb-6 pt-8 md:flex">
            <div className="mb-8 px-2">
              <Wordmark />
            </div>
            <Suspense fallback={<NavLinks pathname="" />}>
              <Nav />
            </Suspense>
            <p className="mt-4 px-2 text-xs text-ink-muted">
              Press <kbd className="rounded-md border border-line-strong bg-tint px-1.5 font-sans text-[11px] font-semibold">?</kbd> for shortcuts
            </p>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="flex items-center justify-between px-5 pb-1 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
              <Wordmark />
            </header>
            <main id="main" className="mx-auto w-full max-w-[1120px] px-5 pb-32 pt-4 md:px-10 md:pb-16 md:pt-10 xl:px-12">
              <IntegrityBanner />
              {children}
            </main>
          </div>
        </div>
        <Suspense fallback={<TabBarLinks pathname="" />}>
          <TabBar />
        </Suspense>
        <Shortcuts />
      </body>
    </html>
  );
}
