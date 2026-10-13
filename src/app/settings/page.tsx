import { Fragment, Suspense } from "react";
import { DataFolder, DataFolderFallback } from "@/components/data-folder";
import { Icon } from "@/components/icons";
import { ImportSection } from "@/components/import-section";
import { IntegrityNote } from "@/components/integrity-note";
import { PageHeader } from "@/components/page-header";
import { CARD } from "@/components/ui";
import { SHORTCUTS } from "@/lib/shortcuts";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" icon="settings" description="Where your data lives, and how the app works." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Suspense fallback={<DataFolderFallback />}>
            <DataFolder />
          </Suspense>
          <Suspense fallback={null}>
            <ImportSection />
          </Suspense>
        </div>
        <div className="space-y-6">
          <section aria-labelledby="shortcuts-settings-heading" className={CARD}>
            <div className="flex gap-4">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-50 text-mint-ink">
                <Icon name="keyboard" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="shortcuts-settings-heading" className="text-lg">
                  Keyboard shortcuts
                </h2>
                <p className="mt-1 text-sm text-ink-muted">On a Mac keyboard, from any page.</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
                  {[...SHORTCUTS, { key: "?", label: "Show or hide the shortcut list" }].map((s) => (
                    <Fragment key={s.key}>
                      <dt>
                        <kbd className="inline-flex min-w-8 justify-center rounded-lg border border-line-strong bg-tint px-2 py-0.5 font-sans text-sm font-semibold text-ink">
                          {s.key}
                        </kbd>
                      </dt>
                      <dd className="text-body">{s.label}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            </div>
          </section>
          <IntegrityNote />
        </div>
      </div>
    </>
  );
}
