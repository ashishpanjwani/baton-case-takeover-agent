import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam, BetaMessage, BetaMessageParam, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { estimateCostUsd } from "./pricing";
import {
  LLMError, type AgentLoopRequest, type AgentTool, type AgentLoopResult, type CallUsage, type Effort, type LLMProvider, type ModelRole,
  type StructuredRequest, type StructuredResult,
} from "./provider";

/** Defaults: a cheap model for per-document extraction, a strong model for cross-document reasoning. */
export const DEFAULT_ANTHROPIC_MODELS: Record<ModelRole, string> = {
  extraction: "claude-haiku-5-5",
  reasoning: "claude-opus-5-5",
  planning: "claude-opus-5-5",
};

/** Models that accept the server-side refusal fallback. Haiku 5.5 has none. */
const SUPPORTS_SERVER_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"]);

export function anthropicModelsFromEnv(env: NodeJS.ProcessEnv = process.env): Record<ModelRole, string> {
  const reasoning = env.ANTHROPIC_REASONING_MODEL || DEFAULT_ANTHROPIC_MODELS.reasoning;
  return {
    extraction: env.ANTHROPIC_EXTRACTION_MODEL || DEFAULT_ANTHROPIC_MODELS.extraction,
    reasoning,
    // Report part 2 follows the reasoning model unless set separately.
    planning: env.ANTHROPIC_PLANNING_MODEL || reasoning,
  };
}

const EFFORTS: Effort[] = ["low", "medium", "high"];

/** Optional effort override for both report calls (reasoning + planning). */
export function reasoningEffortFromEnv(env: NodeJS.ProcessEnv = process.env): Effort | null {
  const v = env.ANTHROPIC_REASONING_EFFORT?.trim().toLowerCase();
  if (!v) return null;
  if (!EFFORTS.includes(v as Effort)) throw new Error(`ANTHROPIC_REASONING_EFFORT must be one of ${EFFORTS.join(", ")}`);
  return v as Effort;
}

/**
 * Agent tools in the API's format.
 *
 * eager_input_streaming is deliberately left off. With it on, the API stops
 * validating and repairing tool inputs as they are generated, so a slightly
 * malformed input arrives here truncated, fails validation, and the agent has
 * to resend it. With smaller models that happened dozens of times in one run.
 * Nothing here shows tool inputs while they stream, so there is nothing to gain.
 * Inputs are still validated with Zod before a tool runs.
 */
export function toolDefinitions(tools: AgentTool[]): BetaTool[] {
  return tools.map((t) => {
    const { $schema: _, ...schema } = z.toJSONSchema(t.input) as Record<string, unknown>;
    return { name: t.name, description: t.description, input_schema: schema as BetaTool["input_schema"] };
  });
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(
    readonly models: Record<ModelRole, string> = anthropicModelsFromEnv(),
    private readonly reasoningEffort: Effort | null = reasoningEffortFromEnv(),
  ) {
    // Credentials are resolved from the environment (ANTHROPIC_API_KEY); never hardcoded.
    this.client = new Anthropic();
  }

  configKey(role: ModelRole): string {
    return `${this.models[role]}|${role !== "extraction" && this.reasoningEffort ? this.reasoningEffort : "default"}`;
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const model = this.models[req.role];
    const effort = req.role !== "extraction" && this.reasoningEffort ? this.reasoningEffort : req.effort;
    const format = betaZodOutputFormat(req.schema);
    const usage: CallUsage[] = [];
    let lastError = "";
    // One retry: if the first response fails validation, ask again with the error.
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = attempt === 0
        ? req.prompt
        : `${req.prompt}\n\nYour previous response failed validation: ${lastError}\nReturn a response that matches the schema exactly.`;
      try {
        const fallback = SUPPORTS_SERVER_FALLBACK.has(model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {};
        const stream = this.client.beta.messages.stream({
          model,
          max_tokens: req.maxTokens,
          thinking: { type: "adaptive" },
          output_config: { effort, format: { type: "json_schema", schema: format.schema } },
          ...fallback,
          system: req.system,
          messages: [{ role: "user", content: prompt }],
        });
        const msg = await stream.finalMessage();
        const inputTokens = msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0);
        const outputTokens = msg.usage.output_tokens;
        // Bill against the model that actually served the request (a fallback may differ).
        usage.push({ role: req.role, model: msg.model, effort, label: req.label, inputTokens, outputTokens, costUsd: estimateCostUsd(msg.model, inputTokens, outputTokens) });

        if (msg.stop_reason === "refusal") throw new LLMError("The model declined this request.", req.label, usage);
        if (msg.stop_reason === "max_tokens") {
          lastError = "Output was truncated (max_tokens reached).";
          continue;
        }
        const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          lastError = "Response was not valid JSON.";
          continue;
        }
        const parsed = req.schema.safeParse(json);
        if (parsed.success) return { output: parsed.data, usage };
        lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      } catch (e) {
        if (e instanceof LLMError) throw e;
        if (e instanceof Anthropic.AuthenticationError) throw new LLMError("Invalid or missing ANTHROPIC_API_KEY.", req.label, usage);
        if (e instanceof Anthropic.NotFoundError) throw new LLMError(`Model not found: ${model}. Check the model settings.`, req.label, usage);
        if (e instanceof Anthropic.RateLimitError) throw new LLMError("Rate limited by the API. Try again shortly.", req.label, usage);
        if (e instanceof Anthropic.APIError) throw new LLMError(`API error ${e.status}: ${e.message}`, req.label, usage);
        throw e;
      }
    }
    throw new LLMError(`Model output failed schema validation: ${lastError}`, req.label, usage);
  }

  /**
   * A manual tool-use loop. Each turn: the model thinks, writes a line of narration
   * and calls tools; the tools run here and their results go back. The loop ends
   * when the engine says the work is accepted, or at the turn limit.
   * The whole conversation is cached, so each turn pays full price only for what is new.
   */
  async runAgentLoop(req: AgentLoopRequest): Promise<AgentLoopResult> {
    const model = this.models[req.role];
    const effort = this.reasoningEffort ?? req.effort;
    const usage: CallUsage[] = [];
    const tools = toolDefinitions(req.tools);
    const byName = new Map(req.tools.map((t) => [t.name, t]));
    // A copy: the saved conversation passed in must not change under the caller.
    const messages: BetaMessageParam[] = req.resume ? [...(req.resume.messages as BetaMessageParam[])] : [{ role: "user", content: req.prompt }];
    let turn = req.resume?.turn ?? 0;
    let badJson = 0;

    const fail = (msg: string) => new LLMError(msg, req.label, usage);
    const firstTurn = turn;
    while (!req.isDone()) {
      if (turn >= req.maxTurns) return { turns: turn, stopped: "turn_limit", usage };
      // Pause only between turns, and only after making progress in this call.
      if (turn > firstTurn && req.shouldPause?.()) return { turns: turn, stopped: "paused", usage };
      let msg: BetaMessage;
      try {
        msg = await this.client.beta.messages
          .stream({
            model,
            max_tokens: req.maxTokensPerTurn,
            thinking: { type: "adaptive" },
            output_config: { effort },
            cache_control: { type: "ephemeral" },
            system: req.system,
            tools,
            messages,
          })
          .finalMessage();
        badJson = 0;
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) throw fail("Invalid or missing ANTHROPIC_API_KEY.");
        if (e instanceof Anthropic.NotFoundError) throw fail(`Model not found: ${model}. Check the model settings.`);
        if (e instanceof Anthropic.RateLimitError) throw fail("Rate limited by the API. Try again shortly.");
        if (e instanceof Anthropic.APIError) throw fail(`API error ${e.status}: ${e.message}`);
        // A tool input the SDK could not parse at all: ask again, a couple of times at most.
        if (badJson++ < 2) continue;
        throw e;
      }
      turn++;
      const u = msg.usage;
      const read = u.cache_read_input_tokens ?? 0;
      const write = u.cache_creation_input_tokens ?? 0;
      const inputTokens = u.input_tokens + read + write;
      usage.push({
        role: req.role, model: msg.model, effort, label: `${req.label} turn ${turn}`, inputTokens, outputTokens: u.output_tokens,
        costUsd: estimateCostUsd(msg.model, inputTokens, u.output_tokens, { read, write }),
      });

      if (msg.stop_reason === "refusal") throw fail("The model declined this request.");
      const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      if (text) req.onText?.(text);
      const calls = msg.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      // A tool call cut off at the output limit can look complete; never run it.
      if (msg.stop_reason === "max_tokens") {
        messages.push({ role: "assistant", content: msg.content as BetaContentBlockParam[] });
        messages.push({ role: "user", content: calls.length
          ? calls.map((c) => ({ type: "tool_result" as const, tool_use_id: c.id, is_error: true, content: "Not run: your output was cut off at the length limit. Make smaller calls (fewer items per turn)." }))
          : "Your output was cut off at the length limit. Continue, with smaller tool calls." });
        req.onTurn?.({ messages, turn });
        continue;
      }
      messages.push({ role: "assistant", content: msg.content as BetaContentBlockParam[] });
      if (calls.length === 0) {
        messages.push({ role: "user", content: req.nudge });
        req.onTurn?.({ messages, turn });
        continue;
      }
      const results: BetaContentBlockParam[] = [];
      for (const c of calls) {
        const tool = byName.get(c.name);
        const parsed = tool?.input.safeParse(c.input);
        let r: { content: string; isError?: boolean };
        if (!tool) r = { content: `Unknown tool: ${c.name}`, isError: true };
        else if (!parsed!.success) {
          const issues = parsed!.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`).join("; ");
          r = { content: `Invalid input, nothing was done. ${issues}`, isError: true };
        } else r = await tool.run(parsed!.data);
        results.push({ type: "tool_result", tool_use_id: c.id, content: r.content, ...(r.isError ? { is_error: true } : {}) } satisfies BetaToolResultBlockParam);
      }
      const note = req.turnNote?.(req.maxTurns - turn);
      if (note) results.push({ type: "text", text: note });
      messages.push({ role: "user", content: results });
      req.onTurn?.({ messages, turn });
    }
    return { turns: turn, stopped: "done", usage };
  }
}
