import { MODEL_ROLES, type CallUsage, type ModelRole } from "../llm/provider";
import type { DocumentAnalysis, TakeoverReport } from "../schemas";
import type { VerificationSummary } from "./verify";

export type InvestigationMode = "ai" | "demo";

export interface RunDocument {
  docId: string;
  title: string;
  hash: string;
  pages: number;
  chars: number;
  analysed: boolean;
  /** Pages read by OCR, with Tesseract confidence (0–100). Absent on older runs. */
  ocrPages?: { page: number; confidence: number }[];
}

export interface InvestigationRun {
  id: string;
  caseId: string;
  mode: InvestigationMode;
  provider: string | null;
  /** Model used for each role (AI mode only). */
  models: Record<ModelRole, string> | null;
  /** Per-role configuration fingerprint (model and effort); used for time estimates. Absent on older runs. */
  configKeys?: Record<ModelRole, string> | null;
  /** Token usage and estimated cost (AI mode only). */
  usage: RunUsage | null;
  startedAt: string;
  completedAt: string;
  documents: RunDocument[];
  /** Stage-1 per-document extraction output (AI mode only). */
  documentAnalyses: DocumentAnalysis[] | null;
  report: TakeoverReport;
  verification: VerificationSummary;
  notices: string[];
  log: InvestigationEvent[];
}

/**
 * The part of a run the report page sends to the browser: what the case manager
 * needs, without models, token usage, cost or the raw event log.
 */
export type ReportRun = Pick<InvestigationRun, "id" | "mode" | "completedAt" | "documents" | "verification" | "notices" | "report">;

export function toReportRun(run: InvestigationRun): ReportRun {
  const { id, mode, completedAt, documents, verification, notices, report } = run;
  return { id, mode, completedAt, documents, verification, notices, report };
}

export interface RunUsage {
  calls: CallUsage[];
  inputTokens: number;
  outputTokens: number;
  /** Sum of per-call estimates; null if any call's model has no known price. */
  estimatedCostUsd: number | null;
  /** Older runs may lack "planning". */
  byRole: Partial<Record<ModelRole, { model: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number | null }>>;
}

export function summariseUsage(calls: CallUsage[], models: Record<ModelRole, string>): RunUsage {
  const sum = (xs: CallUsage[]) => ({
    calls: xs.length,
    inputTokens: xs.reduce((n, c) => n + c.inputTokens, 0),
    outputTokens: xs.reduce((n, c) => n + c.outputTokens, 0),
    costUsd: xs.some((c) => c.costUsd === null) ? null : xs.reduce((n, c) => n + (c.costUsd ?? 0), 0),
  });
  const all = sum(calls);
  const role = (r: ModelRole) => ({ model: models[r], ...sum(calls.filter((c) => c.role === r)) });
  return {
    calls, inputTokens: all.inputTokens, outputTokens: all.outputTokens, estimatedCostUsd: all.costUsd,
    byRole: Object.fromEntries(MODEL_ROLES.map((r) => [r, role(r)])),
  };
}

/** synthesize = report part 1 (history and findings); plan = report part 2 (work status and recovery plan). */
export type InvestigationStage = "extract" | "analyze" | "synthesize" | "plan" | "verify";

export type InvestigationEvent =
  | { type: "run_started"; at: string; runId: string; mode: InvestigationMode; models: Record<ModelRole, string> | null; documentCount: number;
      /** Expected duration (ms) of each AI step; null in demo mode. */
      estimates?: { analyze: number; synthesize: number; plan: number } | null }
  | { type: "stage"; at: string; stage: InvestigationStage; status: "started" | "completed" | "skipped"; detail?: string }
  | { type: "document"; at: string; stage: "extract" | "analyze"; docId: string; title: string; status: "started" | "completed" | "failed"; detail?: string }
  | { type: "notice"; at: string; message: string }
  | { type: "completed"; at: string; runId: string }
  | { type: "failed"; at: string; error: string };
