import { EmptyState } from "@/components/empty-state";
import { HowItWorks } from "@/components/how-it-works";
import { PageHeader } from "@/components/page-header";

export default function ResearchPage() {
  return (
    <>
      <PageHeader
        title="Research"
        icon="research"
        description="Break a question into a plan, and keep sources you have checked yourself."
      />
      <div className="space-y-6">
        <EmptyState title="No research questions yet" art="search">
          Your research questions and verified sources will be kept here. Sources are only ever added by you.
        </EmptyState>
        <HowItWorks
          label="How research works"
          steps={[
            { icon: "lightbulb", title: "Ask a question", text: "Start from what you want to find out." },
            { icon: "tasks", title: "Break it into steps", text: "A small plan you can work through." },
            { icon: "shield", title: "Keep checked sources", text: "Only sources you have verified yourself." },
          ]}
        />
      </div>
    </>
  );
}
