import { Suspense } from "react";
import { TodayData } from "@/components/today-data";
import { TodayGreeting, TodayGreetingFallback, TodayHeaderActions } from "@/components/today-header";

export default function TodayPage() {
  return (
    <>
      <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Suspense fallback={<TodayGreetingFallback />}>
            <TodayGreeting />
          </Suspense>
          <h1 className="mt-1 text-[34px] leading-[1.05] tracking-tight sm:text-[38px]">Your study day</h1>
          <p className="mt-2 text-[15px] text-ink-muted">Everything you need to stay on track today.</p>
        </div>
        <Suspense fallback={null}>
          <TodayHeaderActions />
        </Suspense>
      </header>
      <Suspense fallback={<p className="text-ink-muted">Loading today…</p>}>
        <TodayData />
      </Suspense>
    </>
  );
}
