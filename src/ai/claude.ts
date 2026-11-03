// Claude adapter. Server-only: the API key never leaves this process.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiError, type AIProvider, type AiKind, type AiRequest, type AiResult } from "@/ai/provider";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

// Grading an answer benefits from more thought; the rest is reading and summarising.
const EFFORT: Record<AiKind, "low" | "medium" | "high"> = {
  brief: "medium",
  assess: "high",
  "research-plan": "medium",
};

export class ClaudeProvider implements AIProvider {
  readonly name = "Claude (Anthropic API)";
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model = DEFAULT_MODEL,
    private readonly professorModel = model,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 10 * 60_000 });
  }

  modelFor(kind: AiKind): string {
    return kind === "assess" ? this.professorModel : this.model;
  }

  async generate<T>(request: AiRequest<T>): Promise<AiResult<T>> {
    const model = this.modelFor(request.kind);
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model,
        max_tokens: 16000,
        // If the model declines for policy reasons, the API retries on its default fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        output_config: { effort: EFFORT[request.kind], format: betaZodOutputFormat(request.schema) },
      });
    } catch (error) {
      throw toAiError(error);
    }
    if (response.stop_reason === "refusal") {
      throw new AiError("Claude declined this request. Try different material or rephrase.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("The answer was cut off because it was too long. Try fewer pages.");
    }
    if (response.parsed_output == null) throw new AiError("Claude's answer was not in the expected format. Try again.");
    return { value: response.parsed_output as T, model: response.model };
  }
}

function toAiError(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError) return new AiError("The Anthropic API key was refused. Check ANTHROPIC_API_KEY in .env.local.");
  if (error instanceof Anthropic.PermissionDeniedError) return new AiError("This API key may not use that model. Check ANTHROPIC_MODEL.");
  if (error instanceof Anthropic.NotFoundError) return new AiError("Model not found. Check ANTHROPIC_MODEL in .env.local.");
  if (error instanceof Anthropic.RateLimitError) return new AiError("Rate limit reached. Wait a minute and try again.");
  if (error instanceof Anthropic.BadRequestError) return new AiError(`The request was rejected: ${error.message}`);
  if (error instanceof Anthropic.APIConnectionError) return new AiError("Could not reach the Anthropic API. Check your internet connection.");
  if (error instanceof Anthropic.APIError) return new AiError(`The Anthropic API answered with an error (${error.status ?? "unknown"}). Try again later.`);
  return error instanceof Error ? error : new Error(String(error));
}
