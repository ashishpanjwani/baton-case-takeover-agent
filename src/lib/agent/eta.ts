/**
 * Expected duration of each AI step, shown in the progress panel as time remaining.
 *
 * Learns from this case's earlier runs: the most recent completed run with the
 * same model configuration supplies each step's duration. Without one, it falls
 * back to rough defaults per model family and effort, which the first real run
 * then replaces.
 */
import type { LLMProvider } from "../llm";
import type { ModelRole } from "../llm/provider";
import { listRuns } from "../store";
import type { InvestigationMethod, InvestigationRun, StepEstimates } from "./types";

export type { StepEstimates };
type Step = keyof StepEstimates;

const DEFAULT_SECONDS: Record<"synthesize" | "plan" | "investigate", Record<string, number>> = {
  synthesize: { opus: 300, sonnet: 200, haiku: 120 },
  plan: { opus: 240, sonnet: 135, haiku: 90 },
  // A guess until the first agent run on a case replaces it.
  investigate: { opus: 600, sonnet: 420, haiku: 240 },
};
const EFFORT_FACTOR: Record<string, number> = { high: 1, medium: 0.7, low: 0.5 };
const ANALYZE_SECONDS_PER_BATCH = 25;
const ANALYZE_BATCH = 16;

const family = (model: string) => (/opus/.test(model) ? "opus" : /haiku/.test(model) ? "haiku" : "sonnet");

/** Configuration fingerprint per role; runs only teach estimates for an identical configuration. */
export function configKeys(provider: LLMProvider): Record<ModelRole, string> {
  const key = (r: ModelRole) => provider.configKey?.(r) ?? provider.models[r];
  return { extraction: key("extraction"), reasoning: key("reasoning"), planning: key("planning") };
}

/** Step durations (ms) actually observed in a completed run's event log. */
export function observedDurations(run: InvestigationRun): StepEstimates {
  const t = (i: number) => new Date(run.log[i].at).getTime();
  const idx = (pred: (e: InvestigationRun["log"][number]) => boolean, from = 0) => run.log.findIndex((e, i) => i >= from && pred(e));
  const stage = (s: string, status: string) => (e: InvestigationRun["log"][number]) => e.type === "stage" && e.stage === s && e.status === status;
  const out: StepEstimates = {};
  const i0 = idx(stage("investigate", "started")), i1 = idx(stage("investigate", "completed"));
  if (i0 >= 0 && i1 > i0) out.investigate = t(i1) - t(i0);
  const a0 = idx(stage("analyze", "started")), a1 = idx(stage("analyze", "completed"));
  if (a0 >= 0 && a1 > a0) out.analyze = t(a1) - t(a0);
  const s0 = idx(stage("synthesize", "started"));
  const p0 = idx(stage("plan", "started")), p1 = idx(stage("plan", "completed"));
  if (s0 >= 0 && p0 > s0) {
    out.synthesize = t(p0) - t(s0);
    if (p1 > p0) out.plan = t(p1) - t(p0);
  } else if (s0 >= 0) {
    // Older runs logged both report parts under "synthesize": started (part 1), started (part 2), completed.
    const s0b = idx(stage("synthesize", "started"), s0 + 1), s1 = idx(stage("synthesize", "completed"));
    if (s0b > s0 && s1 > s0b) {
      out.synthesize = t(s0b) - t(s0);
      out.plan = t(s1) - t(s0b);
    }
  }
  // Steps reused from an interrupted run finish instantly and say nothing about real duration.
  for (const k of Object.keys(out) as Step[]) if ((out[k] ?? 0) < 3000) delete out[k];
  return out;
}

export async function estimateSteps(caseId: string, provider: LLMProvider, documentCount: number, method: InvestigationMethod): Promise<StepEstimates> {
  const keys = configKeys(provider);
  const effort = (role: ModelRole) => keys[role].split("|")[1] ?? "high";
  const factor = (role: ModelRole) => EFFORT_FACTOR[effort(role)] ?? 1;
  const est: StepEstimates = method === "agent"
    ? { investigate: DEFAULT_SECONDS.investigate[family(provider.models.reasoning)] * factor("reasoning") * Math.max(1, documentCount / 15) * 1000 }
    : {
        analyze: ANALYZE_SECONDS_PER_BATCH * Math.max(1, Math.ceil(documentCount / ANALYZE_BATCH)) * 1000,
        synthesize: DEFAULT_SECONDS.synthesize[family(provider.models.reasoning)] * factor("reasoning") * 1000,
        plan: DEFAULT_SECONDS.plan[family(provider.models.planning)] * factor("planning") * 1000,
      };
  const role: Record<Step, ModelRole> = { analyze: "extraction", synthesize: "reasoning", plan: "planning", investigate: "reasoning" };
  const learned = new Set<Step>();
  for (const run of await listRuns(caseId)) {
    if (run.mode !== "ai" || !run.configKeys) continue;
    const seen = observedDurations(run);
    for (const step of Object.keys(est) as Step[]) {
      if (learned.has(step) || seen[step] === undefined || run.configKeys[role[step]] !== keys[role[step]]) continue;
      est[step] = seen[step]!;
      learned.add(step);
    }
  }
  return est;
}

/** Total of every step's estimate. */
export const totalEstimate = (e: StepEstimates) => Object.values(e).reduce((n, v) => n + (v ?? 0), 0);
