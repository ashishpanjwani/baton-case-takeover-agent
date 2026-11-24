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

describe("AnthropicProvider agent loop", () => {
  type Block = Record<string, unknown>;
  /** Plays scripted assistant turns; records every request. */
  function stubbedAgent(turns: { content: Block[]; stop: string }[]) {
    process.env.ANTHROPIC_API_KEY ??= "test-key-not-used";
    const provider = new AnthropicProvider({ extraction: "claude-haiku-5-5", reasoning: "claude-opus-5-5", planning: "claude-opus-5-5" }, null);
    const sent: Params[] = [];
    let i = 0;
    (provider as unknown as { client: unknown }).client = {
      beta: { messages: { stream(params: Params) {
        sent.push(structuredClone(params));
        const t = turns[i++];
        return { finalMessage: async () => ({
          model: params.model, stop_reason: t.stop, content: t.content,
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 5000 },
        }) };
      } } },
    };
    return { provider, sent };
  }
  const use = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });

  it("runs tools, returns errors for bad input, re-prompts, caches, and stops when the work is accepted", async () => {
    const { provider, sent } = stubbedAgent([
      { stop: "tool_use", content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "Reading the memo." }, use("t1", "echo", { word: "hi" }), use("t2", "echo", { word: 5 })] },
      { stop: "max_tokens", content: [use("t3", "echo", { word: "cut" })] },
      { stop: "end_turn", content: [{ type: "text", text: "Done, I think." }] },
      { stop: "tool_use", content: [use("t4", "finish", {})] },
    ]);
    let done = false;
    const ran: string[] = [];
    const texts: string[] = [];
    const turnsSeen: number[] = [];
    const r = await provider.runAgentLoop({
      role: "reasoning", label: "test", system: "sys", prompt: "go", effort: "medium", maxTokensPerTurn: 1000, maxTurns: 10,
      tools: [
        { name: "echo", description: "echo", input: z.object({ word: z.string() }), run: (x) => { ran.push((x as { word: string }).word); return { content: "ok" }; } },
        { name: "finish", description: "finish", input: z.object({}), run: () => { done = true; return { content: "accepted" }; } },
      ],
      isDone: () => done, nudge: "Please submit.", turnNote: (left) => `${left} left`,
      onText: (t) => texts.push(t), onTurn: (t) => turnsSeen.push(t.turn),
    });

    expect(r).toMatchObject({ turns: 4, stopped: "done" });
    expect(ran).toEqual(["hi"]); // invalid input and the cut-off call were never run
    expect(texts).toEqual(["Reading the memo.", "Done, I think."]);
    expect(turnsSeen).toEqual([1, 2, 3, 4]);
    expect(r.usage).toHaveLength(4);
    // Cache reads are billed at a tenth of the input rate.
    expect(r.usage[0].costUsd).toBeCloseTo(estimateCostUsd("claude-opus-5-5", 5100, 50, { read: 5000, write: 0 })!, 10);

    const first = sent[0];
    expect(first).toMatchObject({ model: "claude-opus-5-5", system: "sys", cache_control: { type: "ephemeral" }, thinking: { type: "adaptive" }, output_config: { effort: "medium" } });
    const tools = first.tools as { name: string; input_schema: { type: string }; eager_input_streaming?: boolean }[];
    // Eager input streaming stays off, so the API validates tool inputs as they are generated.
    expect(tools.map((t) => [t.name, t.input_schema.type, t.eager_input_streaming])).toEqual([["echo", "object", undefined], ["finish", "object", undefined]]);

    // Turn 2 request carries the turn-1 results: one ok, one error, then the turn note.
    const m2 = sent[1].messages as { role: string; content: Block[] | string }[];
    const res1 = m2.at(-1)!.content as Block[];
    expect(res1[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1", content: "ok" });
    expect(res1[1]).toMatchObject({ tool_use_id: "t2", is_error: true });
    expect(res1[2]).toMatchObject({ type: "text", text: "9 left" });
    // The thinking block is sent back unchanged.
    expect((m2.at(-2)!.content as Block[])[0]).toMatchObject({ type: "thinking" });
    // The cut-off call is answered with an error; the text-only turn gets the nudge.
    const m3 = sent[2].messages as { content: Block[] | string }[];
    expect((m3.at(-1)!.content as Block[])[0]).toMatchObject({ tool_use_id: "t3", is_error: true });
    const m4 = sent[3].messages as { content: Block[] | string }[];
    expect(m4.at(-1)!.content).toBe("Please submit.");
  });

  it("pauses only between turns, after making progress, when asked to", async () => {
    const loop = Array.from({ length: 5 }, (_, k) => ({ stop: "tool_use", content: [use(`p${k}`, "echo", { word: "w" })] }));
    const a = stubbedAgent(loop);
    let saved: { messages: unknown[]; turn: number } | null = null;
    const r = await a.provider.runAgentLoop({
      role: "reasoning", label: "t", system: "s", prompt: "p", effort: "low", maxTokensPerTurn: 100, maxTurns: 10,
      tools: [{ name: "echo", description: "e", input: z.object({ word: z.string() }), run: () => ({ content: "ok" }) }],
      isDone: () => false, nudge: "n", shouldPause: () => true, onTurn: (t) => { saved = structuredClone(t); },
    });
    // Even with shouldPause always true, one turn runs first so every request makes progress.
    expect(r).toMatchObject({ turns: 1, stopped: "paused" });
    expect(a.sent).toHaveLength(1);
    expect(saved!.turn).toBe(1);
  });

  it("stops at the turn limit, and resumes a saved conversation", async () => {
    const loop = (turns: number) => Array.from({ length: turns }, (_, k) => ({ stop: "tool_use", content: [use(`x${k}`, "echo", { word: "w" })] }));
    const tools = [{ name: "echo", description: "e", input: z.object({ word: z.string() }), run: () => ({ content: "ok" }) }];
    const base = { role: "reasoning" as const, label: "t", system: "s", prompt: "p", effort: "low" as const, maxTokensPerTurn: 100, maxTurns: 3, tools, isDone: () => false, nudge: "n" };
    const a = stubbedAgent(loop(5));
    let saved: { messages: unknown[]; turn: number } | null = null;
    const r = await a.provider.runAgentLoop({ ...base, onTurn: (t) => { saved = structuredClone(t); } });
    expect(r).toMatchObject({ turns: 3, stopped: "turn_limit" });
    expect(a.sent).toHaveLength(3);

    const b = stubbedAgent(loop(5));
    const r2 = await b.provider.runAgentLoop({ ...base, maxTurns: 5, resume: saved });
    expect(r2).toMatchObject({ turns: 5, stopped: "turn_limit" });
    expect(b.sent).toHaveLength(2);
    expect((b.sent[0].messages as unknown[]).length).toBe(saved!.messages.length);
  });
});
