// Server-only: decides whether AI is on and which provider answers.
import { ClaudeProvider, DEFAULT_MODEL } from "@/ai/claude";
import type { AIProvider } from "@/ai/provider";

export { AiError, type AIProvider, type AiKind } from "@/ai/provider";

const holder = globalThis as typeof globalThis & { __psaAiOverride?: AIProvider | null };

// Tests swap in a fake provider; `undefined` restores the real choice.
export function setProviderForTests(provider: AIProvider | null | undefined): void {
  holder.__psaAiOverride = provider;
}

// AI is on only when an API key is set. Without one the app works fully, minus AI features.
export function getProvider(): AIProvider | null {
  if (holder.__psaAiOverride !== undefined) return holder.__psaAiOverride;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const professor = process.env.ANTHROPIC_PROFESSOR_MODEL?.trim() || model;
  return new ClaudeProvider(key, model, professor);
}

export function aiStatus(): { on: boolean; name: string | null; model: string | null } {
  const provider = getProvider();
  return provider ? { on: true, name: provider.name, model: provider.modelFor("brief") } : { on: false, name: null, model: null };
}
