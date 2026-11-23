import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { estimateCostUsd } from "./pricing";
import { LLMError, type CallUsage, type Effort, type LLMProvider, type ModelRole, type StructuredRequest, type StructuredResult } from "./provider";

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
}
