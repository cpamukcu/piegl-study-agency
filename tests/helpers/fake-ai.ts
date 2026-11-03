import type { AIProvider, AiKind, AiRequest, AiResult } from "@/ai/provider";

// Answers with whatever the test hands it for each kind, validated by the real schema, and records every request.
export class FakeProvider implements AIProvider {
  readonly name = "Fake";
  readonly requests: AiRequest<unknown>[] = [];

  constructor(private readonly answers: Partial<Record<AiKind, unknown | ((request: AiRequest<unknown>) => unknown)>>) {}

  modelFor(kind: AiKind): string {
    return `fake-${kind}`;
  }

  async generate<T>(request: AiRequest<T>): Promise<AiResult<T>> {
    this.requests.push(request as AiRequest<unknown>);
    const answer = this.answers[request.kind];
    if (answer === undefined) throw new Error(`FakeProvider has no answer for ${request.kind}`);
    const raw = typeof answer === "function" ? (answer as (r: AiRequest<unknown>) => unknown)(request as AiRequest<unknown>) : answer;
    return { value: request.schema.parse(raw), model: this.modelFor(request.kind) };
  }
}
