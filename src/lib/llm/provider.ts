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
  /** Runs a tool-using agent until it finishes or runs out of turns. Optional: providers without it use the fixed workflow. */
  runAgentLoop?(req: AgentLoopRequest): Promise<AgentLoopResult>;
}

/** A tool the agent can call. Inputs are validated against `input` before `run` is called. */
export interface AgentTool {
  name: string;
  description: string;
  input: z.ZodType<unknown>;
  /** Returns the text sent back to the model. `isError` tells the model the call did not succeed. */
  run(input: unknown): Promise<{ content: string; isError?: boolean }> | { content: string; isError?: boolean };
}

/** Saved conversation, so an interrupted agent run can continue where it stopped. Opaque to the engine. */
export interface AgentTranscript {
  messages: unknown[];
  turn: number;
}

export interface AgentLoopRequest {
  role: ModelRole;
  system: string;
  /** The opening instruction. */
  prompt: string;
  tools: AgentTool[];
  effort: Effort;
  /** Output budget per turn (thinking + tool calls). */
  maxTokensPerTurn: number;
  /** Hard limit on model turns. */
  maxTurns: number;
  label: string;
  /** True once the agent's work has been accepted; the loop then stops. */
  isDone(): boolean;
  /** Sent when the model stops without finishing. */
  nudge: string;
  /** Extra text appended to a turn's tool results, e.g. how many turns are left. */
  turnNote?(turnsLeft: number): string | null;
  /** The model's own words between tool calls (its narration). */
  onText?(text: string): void;
  /** Continue a saved conversation instead of starting fresh. */
  resume?: AgentTranscript | null;
  /** Called after every completed turn with the conversation so far. */
  onTurn?(t: AgentTranscript): void;
  /**
   * Checked before each new turn (after at least one turn in this call). Returning true
   * stops the loop cleanly so it can be continued later from `onTurn`'s transcript, e.g.
   * to stay inside a hosting platform's time limit per request.
   */
  shouldPause?(): boolean;
}

export interface AgentLoopResult {
  turns: number;
  stopped: "done" | "turn_limit" | "paused";
  usage: CallUsage[];
}

export class LLMError extends Error {
  constructor(message: string, readonly label: string, readonly usage: CallUsage[] = []) {
    super(`[${label}] ${message}`);
  }
}
