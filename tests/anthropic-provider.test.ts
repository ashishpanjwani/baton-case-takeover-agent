/**
 * Tests the Anthropic provider's request shape and usage accounting with a
 * stubbed SDK client (no network, no API key needed).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODELS, anthropicModelsFromEnv, reasoningEffortFromEnv } from "@/lib/llm/anthropic";
import { estimateCostUsd } from "@/lib/llm/pricing";

type Params = Record<string, unknown> & { model: string };

function stubbedProvider(reply: (p: Params) => { text: string; stop?: string; inTok?: number; outTok?: number }, effort: "low" | "medium" | "high" | null = null) {
  process.env.ANTHROPIC_API_KEY ??= "test-key-not-used";
  const provider = new AnthropicProvider({ extraction: "claude-haiku-5-5", reasoning: "claude-opus-5-5", planning: "claude-sonnet-5-5" }, effort);
  const sent: Params[] = [];
  (provider as unknown as { client: unknown }).client = {
    beta: {
      messages: {
        stream(params: Params) {
          sent.push(params);
          const r = reply(params);
          return {
            finalMessage: async () => ({
              model: params.model,
              stop_reason: r.stop ?? "end_turn",
              content: [{ type: "thinking", thinking: "" }, { type: "text", text: r.text }],
              usage: { input_tokens: r.inTok ?? 1000, output_tokens: r.outTok ?? 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
            }),
          };
        },
      },
    },
  };
  return { provider, sent };
}

const Schema = z.object({ answer: z.string() });
const req = (role: "extraction" | "reasoning" | "planning") => ({
  role, system: "s", prompt: "p", schema: Schema, effort: "low" as const, maxTokens: 1000, label: `test ${role}`,
});

describe("AnthropicProvider", () => {
  it("defaults to Haiku for extraction and Opus for both report parts, overridable by env", () => {
    const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
    expect(DEFAULT_ANTHROPIC_MODELS).toEqual({ extraction: "claude-haiku-5-5", reasoning: "claude-opus-5-5", planning: "claude-opus-5-5" });
    expect(anthropicModelsFromEnv(env({}))).toEqual(DEFAULT_ANTHROPIC_MODELS);
    // Planning follows the reasoning model unless set separately.
    expect(anthropicModelsFromEnv(env({ ANTHROPIC_REASONING_MODEL: "claude-sonnet-5-5" }))).toEqual({
      extraction: "claude-haiku-5-5", reasoning: "claude-sonnet-5-5", planning: "claude-sonnet-5-5",
    });
    expect(anthropicModelsFromEnv(env({ ANTHROPIC_PLANNING_MODEL: "claude-sonnet-5-5" })).planning).toBe("claude-sonnet-5-5");
    expect(reasoningEffortFromEnv(env({}))).toBeNull();
    expect(reasoningEffortFromEnv(env({ ANTHROPIC_REASONING_EFFORT: "Medium" }))).toBe("medium");
    expect(() => reasoningEffortFromEnv(env({ ANTHROPIC_REASONING_EFFORT: "max" }))).toThrow();
  });

  it("applies the reasoning-effort override to report calls only", async () => {
    const { provider, sent } = stubbedProvider(() => ({ text: '{"answer":"ok"}' }), "medium");
    const a = await provider.generateStructured({ ...req("extraction"), effort: "low" });
    const b = await provider.generateStructured({ ...req("reasoning"), effort: "high" });
    const c = await provider.generateStructured({ ...req("planning"), effort: "high" });
    expect((sent[0].output_config as { effort: string }).effort).toBe("low");
    expect((sent[1].output_config as { effort: string }).effort).toBe("medium");
    expect(sent[2].model).toBe("claude-sonnet-5-5");
    expect((sent[2].output_config as { effort: string }).effort).toBe("medium");
    expect([a, b, c].map((r) => r.usage[0].effort)).toEqual(["low", "medium", "medium"]);
  });

  it("sends each role to its model; server fallback only where supported", async () => {
    const { provider, sent } = stubbedProvider(() => ({ text: '{"answer":"ok"}' }));
    await provider.generateStructured(req("extraction"));
    await provider.generateStructured(req("reasoning"));
    expect(sent[0].model).toBe("claude-haiku-5-5");
    expect(sent[0].fallbacks).toBeUndefined();
    expect(sent[0].betas).toBeUndefined();
    expect(sent[1].model).toBe("claude-opus-5-5");
    expect(sent[1].fallbacks).toBe("default");
    expect(sent[1].thinking).toEqual({ type: "adaptive" });
  });

  it("returns validated output with per-call usage and estimated cost", async () => {
    const { provider } = stubbedProvider(() => ({ text: '{"answer":"ok"}', inTok: 2000, outTok: 3000 }));
    const r = await provider.generateStructured(req("extraction"));
    expect(r.output).toEqual({ answer: "ok" });
    expect(r.usage).toHaveLength(1);
    expect(r.usage[0]).toMatchObject({ role: "extraction", model: "claude-haiku-5-5", inputTokens: 2000, outputTokens: 3000 });
    expect(r.usage[0].costUsd).toBeCloseTo((2000 * 0.1 + 3000 * 0.5) / 1e6, 12);
  });

  it("retries once on invalid output and counts both calls", async () => {
    let n = 0;
    const { provider } = stubbedProvider(() => ({ text: n++ === 0 ? '{"wrong":1}' : '{"answer":"ok"}' }));
    const r = await provider.generateStructured(req("reasoning"));
    expect(r.output.answer).toBe("ok");
    expect(r.usage).toHaveLength(2);
  });

  it("fails clearly after repeated invalid output", async () => {
    const { provider } = stubbedProvider(() => ({ text: "not json" }));
    await expect(provider.generateStructured(req("reasoning"))).rejects.toThrow(/schema validation/);
  });
});

describe("estimateCostUsd", () => {
  it("uses list prices and Haiku's long-prompt rate", () => {
    expect(estimateCostUsd("claude-opus-5-5", 1e6, 1e6)).toBe(24);
    expect(estimateCostUsd("claude-sonnet-5-5", 1e6, 1e6)).toBe(12);
    expect(estimateCostUsd("claude-haiku-5-5", 100_000, 0)).toBeCloseTo(0.01);
    expect(estimateCostUsd("claude-haiku-5-5", 200_000, 0)).toBeCloseTo(0.1);
    expect(estimateCostUsd("unknown-model", 1, 1)).toBeNull();
  });
});
