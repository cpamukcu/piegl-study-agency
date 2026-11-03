import { CARD } from "@/components/ui";

export function AiOffNote() {
  return (
    <section className={CARD}>
      <h2 className="text-lg">AI is off</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Add your Anthropic API key as <span className="font-mono">ANTHROPIC_API_KEY</span> in <span className="font-mono">.env.local</span> and
        restart the app to make briefs and get feedback. Everything else works without it, and nothing is sent anywhere.
      </p>
    </section>
  );
}
