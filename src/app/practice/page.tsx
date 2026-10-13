import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { HowItWorks } from "@/components/how-it-works";
import { Icon } from "@/components/icons";
import { IntegrityNote } from "@/components/integrity-note";
import { PageHeader } from "@/components/page-header";
import { BUTTON_PRIMARY } from "@/components/ui";

export default function PracticePage() {
  return (
    <>
      <PageHeader
        title="Practice"
        icon="practice"
        description="Answer professor-style questions one at a time and get honest feedback."
      />
      <div className="space-y-6">
        <EmptyState
          title="Nothing to practise yet"
          art="talk"
          action={
            <Link href="/prepare" className={BUTTON_PRIMARY}>
              Prepare a class
              <Icon name="arrow-right" className="size-4" />
            </Link>
          }
        >
          Questions from your class material will show here once you prepare a class.
        </EmptyState>
        <HowItWorks
          label="How practice works"
          steps={[
            { icon: "prepare", title: "Prepare a class", text: "Add slides or readings for a session." },
            { icon: "practice", title: "Answer one question", text: "In your own words, at your own pace." },
            { icon: "sparkle", title: "Get honest feedback", text: "See what was clear and what to revisit." },
          ]}
        />
        <IntegrityNote />
      </div>
    </>
  );
}
