/**
 * Investigation engine.
 *
 * Agent method (default in AI mode):
 *   1. extract     – read every document and extract text (per page for PDFs, OCR for scans)
 *   2. investigate – the agent runs the investigation with tools (see investigator.ts)
 *   3. verify      – deterministic check of every citation against the raw text
 *
 * Workflow method (INVESTIGATION_METHOD=workflow; the earlier fixed pipeline):
 *   1. extract, 2. analyze (per document), 3. synthesize (report part 1),
 *   4. plan (report part 2), 5. verify
 *
 * Demo mode loads the precomputed report for the seeded case, then verifies it.
 *
 * Progress events are emitted as each real step starts and finishes.
 *
 * Finished AI steps are checkpointed. If a run fails (network error, laptop
 * asleep), the next run reuses those steps instead of paying for them again.
 * API usage of every run, failed ones included, is appended to spend.jsonl.
 */
import { randomUUID } from "node:crypto";
import { extractDocument, type ExtractedDocument } from "../extract";
import type { LLMProvider } from "../llm";
import { LLMError, type CallUsage, type ModelRole } from "../llm/provider";
import { DocumentAnalysisSchema, ReportPart1Schema, ReportPart2Schema, TakeoverReportSchema, type DocumentAnalysis, type ReportPart1, type TakeoverReport } from "../schemas";
import { appendSpend, clearCheckpoint, getCase, readCheckpoint, saveRun, sha256, writeCheckpoint, type CaseDetail } from "../store";
import { configKeys, estimateSteps } from "./eta";
import { emptyState, investigatorPrompt, investigatorSystem, investigatorTools, stateToReport, type InvestigatorState, type TrailEntry } from "./investigator";
import { getDemoReport } from "./demo-report";
import { ROLE, REASONING_RULES, caseContext, documentAnalysisPrompt, synthesisPrompt, type PromptDocument } from "./prompts";
import { summariseUsage, type InvestigationEvent, type InvestigationMethod, type InvestigationRun, type RunDocument } from "./types";
import type { AgentTranscript } from "../llm/provider";
import { verifyReport } from "./verify";

export interface InvestigateOptions {
  caseId: string;
  provider: LLMProvider | null;
  onEvent?: (e: InvestigationEvent) => void;
  /** Override "today" (tests). */
  today?: string;
  /** Defaults to INVESTIGATION_METHOD (agent unless set to "workflow"). */
  method?: InvestigationMethod;
}

/**
 * How AI investigations run. "agent" unless INVESTIGATION_METHOD=workflow,
 * or the provider cannot run an agent.
 */
export function investigationMethod(provider: LLMProvider | null, env: NodeJS.ProcessEnv = process.env): InvestigationMethod {
  const v = (env.INVESTIGATION_METHOD || "agent").trim().toLowerCase();
  if (v !== "agent" && v !== "workflow") throw new Error('INVESTIGATION_METHOD must be "agent" or "workflow"');
  return v === "agent" && provider?.runAgentLoop ? "agent" : "workflow";
}

/** Upper limit on the agent's model turns: bounds the time and cost of a run. */
export function agentMaxTurns(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.AGENT_MAX_TURNS);
  return Number.isFinite(n) && n >= 5 ? Math.floor(n) : 60;
}

const now = () => new Date().toISOString();

/** Per-document analysis calls in flight at once. */
const ANALYSIS_CONCURRENCY = 16;

/** Finished AI steps of an interrupted run, keyed by a hash of each step's exact inputs. */
interface Checkpoint {
  savedAt: string;
  analyses: Record<string, DocumentAnalysis>;
  part1: { key: string; output: ReportPart1 } | null;
  /** The agent's conversation and working report, saved after every turn. */
  agent?: { key: string; state: InvestigatorState; transcript: AgentTranscript; trail: TrailEntry[] } | null;
}

/** Mutable state shared with the failure handler, so a failed run's usage is still recorded. */
interface RunState {
  runId: string | null;
  calls: CallUsage[];
}

export async function investigate(opts: InvestigateOptions): Promise<InvestigationRun> {
  const log: InvestigationEvent[] = [];
  const emit = (e: InvestigationEvent) => {
    log.push(e);
    try {
      opts.onEvent?.(e);
    } catch {
      // A listener failing (e.g. the browser disconnected) must not stop the investigation.
    }
  };
  const state: RunState = { runId: null, calls: [] };
  try {
    const result = await run(opts, emit, log, state);
    if (opts.provider) await recordSpend(opts.caseId, state, "completed", null);
    return result;
  } catch (err) {
    if (err instanceof LLMError) state.calls.push(...err.usage);
    if (opts.provider) await recordSpend(opts.caseId, state, "failed", err instanceof Error ? err.message : String(err));
    emit({ type: "failed", at: now(), error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

async function recordSpend(caseId: string, state: RunState, status: "completed" | "failed", error: string | null) {
  const costs = state.calls.map((c) => c.costUsd);
  await appendSpend(caseId, {
    at: now(), runId: state.runId, status, error,
    estimatedCostUsd: costs.some((c) => c === null) ? null : costs.reduce<number>((a, b) => a + (b ?? 0), 0),
    // A call cut off mid-response (network drop) is billed for what it generated but reports no usage here.
    calls: state.calls,
  }).catch(() => {});
}

async function run(
  opts: InvestigateOptions,
  emit: (e: InvestigationEvent) => void,
  log: InvestigationEvent[],
  state: RunState,
): Promise<InvestigationRun> {
  const c = await getCase(opts.caseId);
  if (!c) throw new Error(`Case ${opts.caseId} not found`);
  if (c.documents.length === 0) throw new Error("This case has no documents to investigate.");

  const provider = opts.provider;
  const mode = provider ? "ai" : "demo";
  const demoReport = provider ? null : getDemoReport(c.id);
  if (!provider && !demoReport) {
    throw new Error("No AI provider is configured (set ANTHROPIC_API_KEY) and no precomputed demo analysis exists for this case.");
  }

  const runId = `run-${Date.now()}-${randomUUID().slice(0, 6)}`;
  state.runId = runId;
  const startedAt = now();
  const notices: string[] = [];
  const method: InvestigationMethod = opts.method && provider?.runAgentLoop ? opts.method : investigationMethod(provider);
  const estimates = provider ? await estimateSteps(c.id, provider, c.documents.length, method) : null;
  emit({ type: "run_started", at: startedAt, runId, mode, method: provider ? method : undefined, models: provider?.models ?? null, documentCount: c.documents.length, estimates });

  // 1. Extract
  emit({ type: "stage", at: now(), stage: "extract", status: "started", detail: `${c.documents.length} documents` });
  const extracted = new Map<string, ExtractedDocument>();
  for (const d of c.documents) {
    emit({ type: "document", at: now(), stage: "extract", docId: d.id, title: d.title, status: "started" });
    try {
      const x = await extractDocument(c.id, d);
      extracted.set(d.id, x);
      const empty = x.charCount === 0;
      if (empty) notices.push(`No text could be extracted from "${d.title}", even with OCR. It was not analysed.`);
      else if (x.emptyPages.length) notices.push(`"${d.title}": no text could be extracted from page${x.emptyPages.length > 1 ? "s" : ""} ${x.emptyPages.join(", ")}, so ${x.emptyPages.length > 1 ? "they were" : "it was"} not analysed.`);
      if (x.ocrPages.length) {
        const low = x.ocrPages.filter((p) => p.confidence < 80).map((p) => p.page);
        notices.push(
          `"${d.title}" is scanned: text on page${x.ocrPages.length > 1 ? "s" : ""} ${x.ocrPages.map((p) => p.page).join(", ")} was read by OCR and may contain recognition errors. Check quoted dates and figures against the original.` +
          (low.length ? ` OCR confidence was low on page${low.length > 1 ? "s" : ""} ${low.join(", ")}.` : ""),
        );
      }
      const ocrNote = x.ocrPages.length ? ` (OCR on ${x.ocrPages.length} page${x.ocrPages.length > 1 ? "s" : ""})` : "";
      emit({
        type: "document", at: now(), stage: "extract", docId: d.id, title: d.title, status: empty ? "failed" : "completed",
        detail: `${d.kind === "pdf" ? `${x.pages.length} page${x.pages.length === 1 ? "" : "s"}, ` : ""}${x.charCount.toLocaleString()} characters${ocrNote}${empty ? " — no extractable text" : ""}`,
      });
    } catch (e) {
      notices.push(`Could not read "${d.title}": ${e instanceof Error ? e.message : e}`);
      emit({ type: "document", at: now(), stage: "extract", docId: d.id, title: d.title, status: "failed", detail: "Could not extract text" });
    }
  }
  emit({ type: "stage", at: now(), stage: "extract", status: "completed" });

  const readable = c.documents.filter((d) => (extracted.get(d.id)?.charCount ?? 0) > 0);
  const promptDocs: PromptDocument[] = readable.map((d) => ({
    id: d.id, title: d.title, category: d.category, kind: d.kind, pages: extracted.get(d.id)!.pages,
    ocrPages: extracted.get(d.id)!.ocrPages.map((p) => p.page),
  }));

  let report: TakeoverReport;
  let analyses: DocumentAnalysis[] | null = null;
  let trail: TrailEntry[] | undefined;
  let agentInfo: InvestigationRun["agent"];
  let analysedIds: Set<string>;
  const calls = state.calls;

  // Checkpoint writes in flight; a failed run waits for them so the next run reads a complete file.
  let saving: Promise<unknown> = Promise.resolve();
  try {
  if (provider) {
    const keyOf = (role: ModelRole, system: string, prompt: string) =>
      sha256(JSON.stringify([provider.configKey?.(role) ?? provider.models[role], system, prompt]));
    // Reuse finished steps from an interrupted run (matched by exact inputs).
    const saved = await readCheckpoint<Checkpoint>(c.id);
    const cp: Checkpoint = { savedAt: now(), analyses: saved?.analyses ?? {}, part1: saved?.part1 ?? null, agent: saved?.agent ?? null };
    const persist = () => (saving = saving.then(() => writeCheckpoint(c.id, { ...cp, savedAt: now() })).catch(() => {}));
    let reused = 0;
    const ctx = caseContext(c);

    if (method === "agent") {
      // 2. The agent investigates.
      const system = investigatorSystem();
      const prompt = investigatorPrompt({ caseContext: ctx, today: opts.today ?? now().slice(0, 10), documents: promptDocs });
      const key = keyOf("reasoning", system, prompt);
      const resume = cp.agent?.key === key ? cp.agent : null;
      const st: InvestigatorState = resume ? resume.state : emptyState();
      const steps: TrailEntry[] = resume ? [...resume.trail] : [];
      const maxTurns = agentMaxTurns();
      let turn = resume?.transcript.turn ?? 0;
      const log = (entry: TrailEntry) => {
        steps.push(entry);
        emit({ type: "agent", at: now(), entry, turn, maxTurns });
      };
      emit({ type: "stage", at: now(), stage: "investigate", status: "started", detail: resume ? "Continuing the interrupted investigation" : undefined });
      if (resume) log({ kind: "thought", text: "Continuing from where the interrupted run stopped." });
      const r = await provider.runAgentLoop!({
        role: "reasoning", label: "investigation", system, prompt,
        tools: investigatorTools(promptDocs, st, log),
        effort: "medium", maxTokensPerTurn: 32000, maxTurns,
        isDone: () => st.accepted,
        nudge: "The report has not been submitted. Continue the investigation using the tools, and call submit_report when the report is complete.",
        turnNote: (left) => (left <= 8 ? `${left} step${left === 1 ? "" : "s"} left. Record what you have established and call submit_report.` : null),
        onText: (t) => log({ kind: "thought", text: t.length > 500 ? `${t.slice(0, 497)}…` : t }),
        resume: resume?.transcript ?? null,
        onTurn: (t) => {
          turn = t.turn;
          cp.agent = { key, state: st, transcript: t, trail: steps };
          persist();
        },
      });
      calls.push(...r.usage);
      if (r.stopped === "turn_limit") {
        log({ kind: "submit", ok: false, text: "Stopped at the limit on how much work one investigation may do; the report holds what had been established" });
        notices.push("The agent reached the limit on how much work one investigation may do before it finished. The report contains what it had established by then, and may be missing items.");
      }
      report = TakeoverReportSchema.parse(stateToReport(st));
      trail = steps;
      agentInfo = { turns: r.turns, maxTurns, stopped: r.stopped };
      emit({ type: "stage", at: now(), stage: "investigate", status: "completed",
        detail: `${st.findings.length} findings, ${st.recoveryPlan.length} next steps` });
      await saving;
      await clearCheckpoint(c.id);
      // A document counts as analysed if the agent read any of it.
      analysedIds = new Set(promptDocs.filter((d) => (st.pagesRead[d.id]?.length ?? 0) > 0).map((d) => d.id));
      const unread = promptDocs.filter((d) => !analysedIds.has(d.id));
      if (unread.length) notices.push(`The agent did not read ${unread.map((d) => `"${d.title}"`).join(", ")}.`);
    } else {
    // 2. Per-document analysis
    const analysisSystem = `${ROLE}\n\n${REASONING_RULES}`;
    emit({ type: "stage", at: now(), stage: "analyze", status: "started" });
    // All documents at once (up to 16): the stage then takes as long as the slowest document.
    // The SDK retries automatically if this hits a rate limit.
    analyses = await mapLimit(promptDocs, ANALYSIS_CONCURRENCY, async (d) => {
      emit({ type: "document", at: now(), stage: "analyze", docId: d.id, title: d.title, status: "started" });
      const prompt = documentAnalysisPrompt(d, ctx);
      const key = keyOf("extraction", analysisSystem, prompt);
      let a = cp.analyses[key];
      if (a) reused++;
      else {
        const r = await provider.generateStructured({
          role: "extraction", label: `analyze ${d.id}`, system: analysisSystem, prompt,
          schema: DocumentAnalysisSchema, effort: "low", maxTokens: 16000,
        });
        calls.push(...r.usage);
        a = { ...r.output, docId: d.id };
        cp.analyses[key] = a;
        persist();
      }
      emit({
        type: "document", at: now(), stage: "analyze", docId: d.id, title: d.title, status: "completed",
        detail: `${a.events.length} events, ${a.workItems.length} work items`,
      });
      return a;
    });
    emit({ type: "stage", at: now(), stage: "analyze", status: "completed",
      detail: reused ? `${reused} of ${promptDocs.length} already done in the interrupted run` : undefined });

    // 3–4. The report, in two calls: the full report schema is too large for one
    //      structured-output grammar. Part 2 builds on part 1's findings.
    const base = { caseContext: ctx, today: opts.today ?? now().slice(0, 10), documents: promptDocs, analyses };
    emit({ type: "stage", at: now(), stage: "synthesize", status: "started" });
    const prompt1 = synthesisPrompt({ ...base, part: 1 });
    const key1 = keyOf("reasoning", ROLE, prompt1);
    let part1: ReportPart1;
    const part1Reused = cp.part1?.key === key1;
    if (part1Reused) part1 = cp.part1!.output;
    else {
      const r = await provider.generateStructured({
        role: "reasoning", label: "report part 1 (overview, timeline, findings)", system: ROLE, prompt: prompt1,
        schema: ReportPart1Schema, effort: "high", maxTokens: 64000,
      });
      calls.push(...r.usage);
      part1 = r.output;
      cp.part1 = { key: key1, output: part1 };
      persist();
    }
    emit({ type: "stage", at: now(), stage: "synthesize", status: "completed",
      detail: `${part1.findings.length} issues found${part1Reused ? " (already done in the interrupted run)" : ""}` });

    emit({ type: "stage", at: now(), stage: "plan", status: "started" });
    const part2 = await provider.generateStructured({
      role: "planning", label: "report part 2 (work status, recovery plan)", system: ROLE,
      prompt: synthesisPrompt({ ...base, part: 2, part1 }),
      schema: ReportPart2Schema, effort: "high", maxTokens: 64000,
    });
    calls.push(...part2.usage);
    report = TakeoverReportSchema.parse({ ...part1, ...part2.output });
    emit({ type: "stage", at: now(), stage: "plan", status: "completed", detail: `${report.recoveryPlan.length} proposed actions` });
    await saving;
    await clearCheckpoint(c.id);
    analysedIds = new Set(promptDocs.map((d) => d.id));
    }
  } else {
    emit({ type: "stage", at: now(), stage: "analyze", status: "skipped", detail: "Demo mode: no AI is used" });
    emit({ type: "stage", at: now(), stage: "synthesize", status: "completed", detail: "Prepared example analysis loaded" });
    emit({ type: "stage", at: now(), stage: "plan", status: "completed", detail: "Prepared example plan loaded" });
    report = TakeoverReportSchema.parse(demoReport);
    analysedIds = new Set(readable.filter((d) => d.origin === "seed").map((d) => d.id));
    const notCovered = readable.filter((d) => d.origin === "upload");
    if (notCovered.length) {
      notices.push(
        `Demo mode: ${notCovered.length} uploaded document${notCovered.length === 1 ? " was" : "s were"} read but not analysed (${notCovered.map((d) => `"${d.title}"`).join(", ")}). The prepared example covers only the original case file.`,
      );
    }
  }

  } catch (err) {
    await saving;
    throw err;
  }

  // 4. Verify
  emit({ type: "stage", at: now(), stage: "verify", status: "started", detail: "Matching every cited excerpt against the source text" });
  const pages = new Map([...extracted].filter(([id]) => analysedIds.has(id)).map(([id, x]) => [id, x.pages]));
  const verified = verifyReport(report, pages);
  const v = verified.verification;
  emit({ type: "stage", at: now(), stage: "verify", status: "completed",
    detail: `${v.verifiedCitations} of ${v.totalCitations} citations verified${v.removedCitations.length ? `, ${v.removedCitations.length} removed` : ""}${v.rejectedItems.length ? `, ${v.rejectedItems.length} unsupported items withheld` : ""}` });

  for (const n of notices) emit({ type: "notice", at: now(), message: n });

  const documents: RunDocument[] = c.documents.map((d) => {
    const x = extracted.get(d.id);
    return { docId: d.id, title: d.title, hash: x?.hash ?? "", pages: x?.pages.length ?? 0, chars: x?.charCount ?? 0, analysed: analysedIds.has(d.id), ocrPages: x?.ocrPages ?? [] };
  });

  const completedAt = now();
  emit({ type: "completed", at: completedAt, runId });
  const result: InvestigationRun = {
    id: runId, caseId: c.id, mode, provider: provider?.name ?? null, models: provider?.models ?? null,
    configKeys: provider ? configKeys(provider) : null,
    usage: provider ? summariseUsage(calls, provider.models) : null,
    startedAt, completedAt, documents, documentAnalyses: analyses,
    report: verified.report, verification: v, notices, log,
    method: provider ? method : undefined, trail, agent: agentInfo,
  };
  await saveRun(result);
  return result;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export type { CaseDetail };
