// The one door to an AI model. Everything AI-generated in the app goes through `AIProvider.generate`,
// returns data checked against a Zod schema, and is stored with the model name that made it.
import type { z } from "zod";

export type AiKind = "brief" | "assess" | "research-plan";

export type AiRequest<T> = {
  kind: AiKind;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
};

export type AiResult<T> = { value: T; model: string };

export interface AIProvider {
  readonly name: string;
  modelFor(kind: AiKind): string;
  generate<T>(request: AiRequest<T>): Promise<AiResult<T>>;
}

// A message the owner can act on (bad key, rate limit, refusal). Anything else is a bug and is thrown as is.
export class AiError extends Error {
  name = "AiError";
}
