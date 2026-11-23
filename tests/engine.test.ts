import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { LLMProvider, StructuredRequest, StructuredResult } from "@/lib/llm/provider";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "cta-test-"));
  process.env.DATA_DIR = tmp;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// Import after DATA_DIR is set.
const load = async () => {
  vi.resetModules();
  const engine = await import("@/lib/agent/engine");
  const store = await import("@/lib/store");
  const demo = await import("@/lib/agent/demo-report");
  const schemas = await import("@/lib/schemas");
  return { ...engine, ...store, ...demo, ...schemas };
};

describe("demo mode investigation", () => {
  it("every citation in the precomputed demo report verifies against the real documents", async () => {
    const { investigate } = await load();
    const run = await investigate({ caseId: "cw-2026-0187", provider: null });
    const v = run.verification;
    if (v.removedCitations.length) console.error(v.removedCitations);
    expect(v.removedCitations).toEqual([]);
    expect(v.rejectedItems).toEqual([]);
    expect(v.verifiedCitations).toBe(v.totalCitations);
    expect(v.totalCitations).toBeGreaterThan(100);
    expect(run.mode).toBe("demo");
    expect(run.models).toBeNull();
    expect(run.usage).toBeNull();
  });

  it("produces all four finding categories and both completion bases", async () => {
    const { investigate } = await load();
    const run = await investigate({ caseId: "cw-2026-0187", provider: null });
    const cats = new Set(run.report.findings.map((f) => f.category));
    expect(cats).toEqual(new Set(["confirmed_incomplete", "potentially_incomplete", "unverified", "conflicting"]));
    expect(new Set(run.report.completedWork.map((c) => c.basis))).toEqual(new Set(["outcome_documented", "action_documented"]));
    expect(new Set(run.report.outstandingWork.map((o) => o.status))).toEqual(new Set(["confirmed_outstanding", "status_unknown"]));
  });

  it("assigns page numbers to PDF citations from the match, not the author", async () => {
    const { investigate } = await load();
    const run = await investigate({ caseId: "cw-2026-0187", provider: null });
    const f1 = run.report.findings.find((f) => f.id === "F1")!;
    const pdfEv = f1.evidence.filter((e) => e.docId === "doc-09");
    expect(pdfEv.every((e) => e.page === 1)).toBe(true);
    const bayside = run.report.timeline.find((t) => t.date === "2026-04-08")!;
    expect(bayside.evidence[0].page).toBe(3);
    const txt = f1.evidence.find((e) => e.docId === "doc-12")!;
    expect(txt.page).toBeNull();
  });

  it("all related finding ids resolve", async () => {
    const { investigate } = await load();
    const { report } = await investigate({ caseId: "cw-2026-0187", provider: null });
    const ids = new Set(report.findings.map((f) => f.id));
    for (const x of [...report.timeline, ...report.outstandingWork, ...report.recoveryPlan])
      for (const id of x.relatedFindingIds) expect(ids.has(id), id).toBe(true);
  });

  it("emits real progress events for every document", async () => {
    const { investigate } = await load();
    const events: string[] = [];
    await investigate({ caseId: "cw-2026-0187", provider: null, onEvent: (e) => events.push(e.type === "document" ? `${e.stage}:${e.docId}:${e.status}` : e.type) });
    expect(events.filter((e) => e.startsWith("extract:") && e.endsWith(":completed"))).toHaveLength(15);
    expect(events.at(-1)).toBe("completed");
  });

  it("uploaded documents are extracted but flagged as not analysed in demo mode", async () => {
    const { investigate, addUpload } = await load();
    await addUpload("cw-2026-0187", { filename: "late-note.txt", bytes: Buffer.from("Client called 11/05/2026 about a new MRI.") });
    const run = await investigate({ caseId: "cw-2026-0187", provider: null });
    const up = run.documents.find((d) => d.docId.startsWith("up-"))!;
    expect(up.chars).toBeGreaterThan(0);
    expect(up.analysed).toBe(false);
    expect(run.notices.join(" ")).toMatch(/not analysed/);
  });
});

describe("AI mode with a mock provider", () => {
  it("routes each step to its model role, records usage, and strips fabricated citations", async () => {
    const { investigate, getDemoReport, TakeoverReportSchema } = await load();
    const base = structuredClone(getDemoReport("cw-2026-0187")!);
    // Inject a fabricated citation and an unsupported finding.
    base.findings[0].evidence.push({ docId: "doc-09", quote: "All records for 04/29/2026 were enclosed.", page: 2, note: null });
    base.findings.push({ ...base.findings[0], id: "F99", title: "Fabricated finding", evidence: [{ docId: "doc-99", quote: "This document does not exist at all", page: null, note: null }] });
    const calls: string[] = [];
    const roles: Record<string, string> = {};
    const models = { extraction: "cheap-model", reasoning: "strong-model", planning: "plan-model" };
    const usage = (req: StructuredRequest<unknown>, inp: number, out: number) => [
      { role: req.role, model: models[req.role], label: req.label, inputTokens: inp, outputTokens: out, costUsd: (inp + out) / 1e6 },
    ];
    const provider: LLMProvider = {
      name: "mock", models,
      async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
        calls.push(req.label);
        roles[req.label] = req.role;
        if (req.label.startsWith("analyze")) {
          const docId = req.label.split(" ")[1];
          const output = req.schema.parse({ docId, documentType: "x", documentDate: null, author: null, summary: "s", events: [], workItems: [], referencedEntities: [] });
          return { output, usage: usage(req as StructuredRequest<unknown>, 1000, 500) };
        }
        // Each synthesis part is answered with the matching slice of the report; the schema strips the rest.
        return { output: req.schema.parse(TakeoverReportSchema.parse(base)), usage: usage(req as StructuredRequest<unknown>, 10000, 15000) };
      },
    };
    const run = await investigate({ caseId: "cw-2026-0187", provider });
    expect(calls.filter((c) => c.startsWith("analyze")).length).toBeGreaterThanOrEqual(15);
    const synth = calls.filter((c) => c.startsWith("report part"));
    expect(synth).toHaveLength(2);
    expect(synth[0]).toMatch(/part 1/);
    expect(synth[1]).toMatch(/part 2/);
    // The merged report has every section, from both parts.
    expect(run.report.findings.length).toBeGreaterThan(0);
    expect(run.report.recoveryPlan.length).toBeGreaterThan(0);
    expect(run.report.timeline.length).toBeGreaterThan(0);
    expect(run.report.completedWork.length).toBeGreaterThan(0);
    expect(run.mode).toBe("ai");
    // Extraction calls use the cheap role, the synthesis uses the reasoning role.
    for (const [label, role] of Object.entries(roles))
      expect(role).toBe(label.startsWith("analyze") ? "extraction" : label.includes("part 1") ? "reasoning" : "planning");
    expect(run.models).toEqual(models);
    const n = calls.filter((c) => c.startsWith("analyze")).length;
    expect(run.usage!.byRole.extraction).toMatchObject({ model: "cheap-model", calls: n, inputTokens: n * 1000, outputTokens: n * 500 });
    expect(run.usage!.byRole.reasoning).toMatchObject({ model: "strong-model", calls: 1, inputTokens: 10000, outputTokens: 15000 });
    expect(run.usage!.byRole.planning).toMatchObject({ model: "plan-model", calls: 1, inputTokens: 10000, outputTokens: 15000 });
    expect(run.usage!.estimatedCostUsd).toBeCloseTo((n * 1500 + 50000) / 1e6, 10);
    expect(run.verification.removedCitations.map((r) => r.reason).sort()).toEqual(["quote_not_found", "unknown_document"]);
    expect(run.report.findings.find((f) => f.id === "F99")).toBeUndefined();
    expect(run.verification.rejectedItems.map((r) => r.id)).toContain("F99");
  });
});

describe("resilience and progress", () => {
  const analysis = (docId: string) => ({ docId, documentType: "x", documentDate: null, author: null, summary: "s", events: [], workItems: [], referencedEntities: [] });
  const mock = (opts: { failPart2?: () => boolean; onCall?: (label: string) => void } = {}) => {
    const models = { extraction: "cheap-model", reasoning: "strong-model", planning: "plan-model" };
    const provider: LLMProvider = {
      name: "mock", models,
      configKey: (r) => `${models[r]}|default`,
      async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
        opts.onCall?.(req.label);
        const { getDemoReport, TakeoverReportSchema } = await import("@/lib/agent/demo-report").then(async (m) => ({ ...m, ...(await import("@/lib/schemas")) }));
        const usage = [{ role: req.role, model: models[req.role], label: req.label, inputTokens: 10, outputTokens: 10, costUsd: 0.001 }];
        if (req.label.startsWith("analyze")) return { output: req.schema.parse(analysis(req.label.split(" ")[1])), usage };
        if (req.label.includes("part 2") && opts.failPart2?.()) throw new Error("socket hang up");
        return { output: req.schema.parse(TakeoverReportSchema.parse(getDemoReport("cw-2026-0187"))), usage };
      },
    };
    return provider;
  };

  it("a failed run keeps finished steps; the next run reuses them and only pays for the rest", async () => {
    const { investigate, readCheckpoint } = await load();
    const { readFile } = await import("node:fs/promises");
    const calls1: string[] = [];
    await expect(investigate({ caseId: "cw-2026-0187", provider: mock({ failPart2: () => true, onCall: (l) => calls1.push(l) }) })).rejects.toThrow(/socket hang up/);
    const nDocs = calls1.filter((l) => l.startsWith("analyze")).length;
    expect(nDocs).toBeGreaterThanOrEqual(15);
    expect(await readCheckpoint("cw-2026-0187")).not.toBeNull();

    const calls2: string[] = [];
    const events: string[] = [];
    const run = await investigate({
      caseId: "cw-2026-0187", provider: mock({ onCall: (l) => calls2.push(l) }),
      onEvent: (e) => { if (e.type === "stage" && e.status === "completed" && e.detail) events.push(`${e.stage}: ${e.detail}`); },
    });
    // Only report part 2 was paid for again.
    expect(calls2).toEqual(["report part 2 (work status, recovery plan)"]);
    expect(events.find((e) => e.startsWith("analyze"))).toBe(`analyze: ${nDocs} of ${nDocs} already done in the interrupted run`);
    expect(events.find((e) => e.startsWith("synthesize"))).toMatch(/already done/);
    expect(run.report.findings.length).toBeGreaterThan(0);
    // A successful run clears the checkpoint, so the next run starts fresh.
    expect(await readCheckpoint("cw-2026-0187")).toBeNull();

    // Spend is recorded for both runs, the failed one included.
    const spend = (await readFile(path.join(tmp, "cases", "cw-2026-0187", "spend.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
    const last2 = spend.slice(-2);
    expect(last2.map((r) => r.status)).toEqual(["failed", "completed"]);
    expect(last2[0].calls.length).toBe(nDocs + 1);
    expect(last2[1].calls.length).toBe(1);
  });

  it("keeps running when the progress listener fails (browser disconnected)", async () => {
    const { investigate } = await load();
    let n = 0;
    const run = await investigate({ caseId: "cw-2026-0187", provider: mock(), onEvent: () => { if (n++ > 3) throw new Error("Controller is already closed"); } });
    expect(run.report.findings.length).toBeGreaterThan(0);
  });

  it("announces step estimates and never puts model names in progress messages", async () => {
    const { investigate } = await load();
    const events: import("@/lib/agent/types").InvestigationEvent[] = [];
    await investigate({ caseId: "cw-2026-0187", provider: mock(), onEvent: (e) => events.push(e) });
    const started = events.find((e) => e.type === "run_started");
    expect(started && started.type === "run_started" && started.estimates).toMatchObject({ analyze: expect.any(Number), synthesize: expect.any(Number), plan: expect.any(Number) });
    const details = events.flatMap((e) => (e.type === "stage" && e.detail ? [e.detail] : []));
    for (const d of details) expect(d).not.toMatch(/model|claude|haiku|opus|sonnet/i);
    expect(events.filter((e) => e.type === "stage" && e.stage === "plan").map((e) => e.type === "stage" && e.status)).toEqual(["started", "completed"]);
  });
});

describe("step time estimates", () => {
  it("learns step durations from earlier runs' logs, old and new formats", async () => {
    const { observedDurations } = await import("@/lib/agent/eta");
    const at = (s: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, s)).toISOString();
    const st = (stage: string, status: string, s: number) => ({ type: "stage", stage, status, at: at(s) });
    const mk = (log: object[]) => ({ log }) as unknown as import("@/lib/agent/types").InvestigationRun;
    expect(observedDurations(mk([st("analyze", "started", 0), st("analyze", "completed", 20), st("synthesize", "started", 20), st("synthesize", "completed", 140), st("plan", "started", 140), st("plan", "completed", 230)])))
      .toEqual({ analyze: 20000, synthesize: 120000, plan: 90000 });
    // Older runs: both report parts under "synthesize".
    expect(observedDurations(mk([st("synthesize", "started", 0), st("synthesize", "started", 300), st("synthesize", "completed", 420)])))
      .toEqual({ synthesize: 300000, plan: 120000 });
    // Steps reused from an interrupted run (near-instant) teach nothing.
    expect(observedDurations(mk([st("analyze", "started", 0), st("analyze", "completed", 1)]))).toEqual({});
  });
});

