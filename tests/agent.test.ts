/**
 * The investigating agent, driven by a scripted fake model: each "turn" is a list
 * of tool calls. This exercises the real tools, the submission gate, the trail,
 * checkpoint resume and the final verification, with no API calls.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AgentLoopRequest, AgentLoopResult, LLMProvider } from "@/lib/llm/provider";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "cta-agent-"));
  process.env.DATA_DIR = tmp;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const load = async () => {
  vi.resetModules();
  return { ...(await import("@/lib/agent/engine")), ...(await import("@/lib/agent/demo-report")), ...(await import("@/lib/store")) };
};

type Call = [string, unknown];
const CASE = "cw-2026-0187";

/** A fake model that plays a fixed script of turns through the real tools. */
function scriptedProvider(script: Call[][], opts: { failAfterTurn?: number; seen?: string[][] } = {}): LLMProvider {
  return {
    name: "scripted",
    models: { extraction: "fake", reasoning: "fake", planning: "fake" },
    configKey: (r) => `fake-${r}`,
    async generateStructured() {
      throw new Error("the agent should not use the fixed workflow");
    },
    async runAgentLoop(req: AgentLoopRequest): Promise<AgentLoopResult> {
      const tools = new Map(req.tools.map((t) => [t.name, t]));
      let turn = req.resume?.turn ?? 0;
      const messages = [...(req.resume?.messages ?? [])];
      while (!req.isDone()) {
        if (turn >= req.maxTurns || turn >= script.length) return { turns: turn, stopped: "turn_limit", usage: [] };
        req.onText?.(`Turn ${turn + 1}: working.`);
        const results: string[] = [];
        for (const [name, input] of script[turn]) {
          const t = tools.get(name);
          if (!t) throw new Error(`no tool ${name}`);
          const p = t.input.safeParse(input);
          const r = p.success ? await t.run(p.data) : { content: `INVALID ${p.error.message}`, isError: true };
          results.push(`${name}: ${r.isError ? "ERROR " : ""}${r.content}`);
        }
        opts.seen?.push(results);
        turn++;
        messages.push({ turn, results });
        req.onTurn?.({ messages, turn });
        if (opts.failAfterTurn === turn) throw new Error("network dropped");
      }
      return { turns: turn, stopped: "done", usage: [] };
    },
  };
}

/** Script built from the hand-written reference report, which is known to be fully supported. */
async function goodScript(withBadFirstSubmit: boolean): Promise<Call[][]> {
  const { getDemoReport, getCase } = await load();
  const r = getDemoReport(CASE)!;
  const c = (await getCase(CASE))!;
  const nullId = <T extends { id: string }>(x: T) => ({ ...x, id: null });
  const turns: Call[][] = [
    c.documents.slice(0, 8).map((d) => ["read_document", { docId: d.id, pages: null }] as Call),
    [["search_case_file", { query: "Harborview Orthopedic" }], ["check_quote", { docId: "doc-12", quote: "this quote is not in the task history at all" }]],
  ];
  if (withBadFirstSubmit) {
    // A finding with a made-up quote, then a premature submit.
    turns.push([["record_finding", { ...r.findings[0], id: null, evidence: [{ docId: "doc-09", quote: "The provider sent every record in full.", page: 1, note: null }] }]]);
    turns.push([["submit_report", {}]]);
    turns.push([["remove_item", { id: "F1" }]]);
  }
  turns.push(c.documents.slice(8).map((d) => ["read_document", { docId: d.id, pages: null }] as Call));
  turns.push([["set_overview", r.overview], ...r.findings.map((f) => ["record_finding", nullId(f)] as Call)]);
  turns.push([
    ...r.timeline.map((t) => ["record_timeline_event", { ...t, id: null }] as Call),
    ...r.completedWork.map((x) => ["record_completed_work", nullId(x)] as Call),
    ...r.outstandingWork.map((x) => ["record_outstanding_work", nullId(x)] as Call),
  ]);
  turns.push([...r.recoveryPlan.map((a) => ["record_action", nullId(a)] as Call), ["set_limitations", { limitations: r.limitations }]]);
  turns.push([["submit_report", {}]]);
  return turns;
}

describe("investigating agent", () => {
  it("every tool's input converts to a JSON schema object for the API", async () => {
    const { investigatorTools, emptyState } = await import("@/lib/agent/investigator");
    for (const t of investigatorTools([], emptyState(), () => {})) {
      const s = z.toJSONSchema(t.input) as { type?: string };
      expect(s.type, t.name).toBe("object");
    }
  });

  it("investigates through tools, is held at the gate until the report is supported, and leaves a trail", async () => {
    const { investigate } = await load();
    const seen: string[][] = [];
    const run = await investigate({ caseId: CASE, provider: scriptedProvider(await goodScript(true), { seen }), method: "agent", today: "2026-11-03" });

    // The bad quote was caught when recorded, and the premature submit was refused with reasons.
    const flat = seen.flat();
    expect(flat.find((l) => l.startsWith("record_finding: ERROR"))).toMatch(/NOT FOUND in doc-09/);
    const refused = flat.find((l) => l.startsWith("submit_report: ERROR"))!;
    expect(refused).toMatch(/not read/);
    expect(refused).toMatch(/No overview/);
    expect(refused).toMatch(/quote.*not found/);
    expect(flat.at(-1)).toMatch(/submit_report: Report accepted/);

    expect(run.method).toBe("agent");
    expect(run.agent).toMatchObject({ stopped: "done" });
    expect(run.verification.removedCitations).toEqual([]);
    expect(run.report.findings).toHaveLength(12);
    expect(run.documents.every((d) => d.analysed)).toBe(true);

    const kinds = new Set(run.trail!.map((t) => t.kind));
    for (const k of ["thought", "read", "search", "check", "record", "remove", "submit"]) expect(kinds.has(k as never), k).toBe(true);
    expect(run.trail!.some((t) => t.kind === "submit" && t.ok === false)).toBe(true);
    expect(run.trail!.find((t) => t.kind === "search")!.text).toMatch(/Searched the file for “Harborview Orthopedic” — \d+ matches/);
    // Progress shows the agent stage, not the workflow's stages.
    const stages = run.log.flatMap((e) => (e.type === "stage" ? [e.stage] : []));
    expect(stages).toContain("investigate");
    expect(stages).not.toContain("synthesize");
  });

  it("an interrupted run continues from the saved conversation instead of starting over", async () => {
    const { investigate, readCheckpoint } = await load();
    const script = await goodScript(false);
    await expect(investigate({ caseId: CASE, provider: scriptedProvider(script, { failAfterTurn: 2 }), method: "agent", today: "2026-11-03" })).rejects.toThrow(/network dropped/);
    const cp = await readCheckpoint<{ agent: { transcript: { turn: number }; state: { pagesRead: Record<string, number[]> } } }>(CASE);
    expect(cp!.agent.transcript.turn).toBe(2);
    expect(Object.keys(cp!.agent.state.pagesRead)).toHaveLength(8);

    const seen: string[][] = [];
    const run = await investigate({ caseId: CASE, provider: scriptedProvider(script, { seen }), method: "agent", today: "2026-11-03" });
    expect(seen).toHaveLength(script.length - 2); // only the remaining turns ran
    // The trail keeps the interrupted run's steps, then notes where it picked up.
    const at = run.trail!.findIndex((t) => /Continuing from where the interrupted run stopped/.test(t.text));
    expect(at).toBeGreaterThan(0);
    expect(run.trail!.slice(0, at).filter((t) => t.kind === "read")).toHaveLength(8);
    expect(run.agent).toMatchObject({ stopped: "done" });
    expect(await readCheckpoint(CASE)).toBeNull();
  });

  it("stops at the step limit and says so", async () => {
    const { investigate } = await load();
    const script = (await goodScript(false)).slice(0, 3); // never submits
    const run = await investigate({ caseId: CASE, provider: scriptedProvider(script), method: "agent", today: "2026-11-03" });
    expect(run.agent).toMatchObject({ stopped: "turn_limit" });
    expect(run.notices.join(" ")).toMatch(/reached the limit on how much work/);
  });

  it("tells the agent how to rank findings, compare fault statements, handle another person's records and narrate", async () => {
    const { investigatorSystem } = await import("@/lib/agent/investigator");
    const sys = investigatorSystem();
    expect(sys).toMatch(/Rank findings by how much each one affects the case/);
    expect(sys).toMatch(/its own recovery step/);
    expect(sys).toMatch(/Statements about fault are facts you can compare/);
    expect(sys).toMatch(/another person's private information/);
    expect(sys).toMatch(/never mention tools, parameters/);
    // The shared reasoning rules are still included.
    expect(sys).toMatch(/Do not draw legal conclusions/);
  });

  it("uses the fixed workflow when asked to", async () => {
    const { investigationMethod } = await load();
    const p = scriptedProvider([]);
    const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
    expect(investigationMethod(p, env({}))).toBe("agent");
    expect(investigationMethod(p, env({ INVESTIGATION_METHOD: "workflow" }))).toBe("workflow");
    expect(investigationMethod({ ...p, runAgentLoop: undefined }, env({}))).toBe("workflow");
  });
});
