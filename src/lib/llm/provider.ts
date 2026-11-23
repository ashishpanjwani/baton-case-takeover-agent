import type { z } from "zod";

/**
 * The job a model call does. Providers map each role to a model, so cheap
 * models can handle simple high-volume work and strong models the hard reasoning.
 *   extraction – per-document structured extraction (simple, many calls)
 *   reasoning  – report part 1: overview, timeline, findings (the hard part)
 *   planning   – report part 2: work status and recovery plan, built on part 1
 */
export type ModelRole = "extraction" | "reasoning" | "planning";
export const MODEL_ROLES: ModelRole[] = ["extraction", "reasoning", "planning"];
export type Effort = "low" | "medium" | "high";

export interface StructuredRequest<T> {
  role: ModelRole;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Relative reasoning depth. Providers map this to their own controls. */
  effort: Effort;
  maxTokens: number;
  /** Used for logging/errors only. */
  label: string;
}

export interface CallUsage {
  role: ModelRole;
  model: string;
  /** Effort actually sent (after any configured override). */
  effort?: Effort;
  label: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated from list prices; null if the model's price is unknown. */
  costUsd: number | null;
}

export interface StructuredResult<T> {
  output: T;
  /** One entry per API call, including retries. */
  usage: CallUsage[];
}

/**
 * Model-agnostic interface the investigation engine depends on.
 * Implementations must return output that has been validated against `schema`.
 */
export interface LLMProvider {
  readonly name: string;
  readonly models: Record<ModelRole, string>;
  /**
   * Fingerprint of everything that changes a role's output (model, effort override),
   * formatted "model|effort". Used to reuse finished steps and to learn step durations.
   */
  configKey?(role: ModelRole): string;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

export class LLMError extends Error {
  constructor(message: string, readonly label: string, readonly usage: CallUsage[] = []) {
    super(`[${label}] ${message}`);
  }
}
