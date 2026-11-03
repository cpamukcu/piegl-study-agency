import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic {
    beta = { messages: { parse } };
    static AuthenticationError = actual.default.AuthenticationError;
    static PermissionDeniedError = actual.default.PermissionDeniedError;
    static NotFoundError = actual.default.NotFoundError;
    static RateLimitError = actual.default.RateLimitError;
    static BadRequestError = actual.default.BadRequestError;
    static APIConnectionError = actual.default.APIConnectionError;
    static APIError = actual.default.APIError;
  }
  return { ...actual, default: FakeAnthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import { ClaudeProvider } from "@/ai/claude";
import { aiStatus, getProvider, setProviderForTests } from "@/ai";

const schema = z.object({ answer: z.string() });
const request = { kind: "brief" as const, system: "sys", prompt: "hello", schema };

beforeEach(() => {
  parse.mockReset();
  setProviderForTests(undefined);
  vi.unstubAllEnvs();
});

describe("ClaudeProvider", () => {
  it("asks for structured output with refusal fallback, and returns the parsed value", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { answer: "ok" }, model: "claude-sonnet-5-5" });
    const provider = new ClaudeProvider("key", "claude-sonnet-5-5", "claude-opus-5-5");
    expect(await provider.generate(request)).toEqual({ value: { answer: "ok" }, model: "claude-sonnet-5-5" });
    const params = parse.mock.calls[0][0];
    expect(params).toMatchObject({
      model: "claude-sonnet-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: "sys",
      messages: [{ role: "user", content: "hello" }],
      output_config: { effort: "medium" },
    });
    expect(params.output_config.format).toBeDefined();
    expect(provider.modelFor("assess")).toBe("claude-opus-5-5");
  });

  it("turns refusals, cut-offs and API errors into messages the owner can act on", async () => {
    const provider = new ClaudeProvider("key");
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null, model: "m" });
    await expect(provider.generate(request)).rejects.toThrow("declined");
    parse.mockResolvedValueOnce({ stop_reason: "max_tokens", parsed_output: null, model: "m" });
    await expect(provider.generate(request)).rejects.toThrow("cut off");
    parse.mockRejectedValueOnce(new Anthropic.AuthenticationError(401, { type: "error" }, "bad key", new Headers()));
    await expect(provider.generate(request)).rejects.toThrow("ANTHROPIC_API_KEY");
  });
});

describe("AI on or off", () => {
  it("is off without an API key, and on with one", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(getProvider()).toBeNull();
    expect(aiStatus()).toEqual({ on: false, name: null, model: null });
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(aiStatus()).toMatchObject({ on: true, model: "claude-sonnet-5-5" });
  });
});
