/**
 * The investigating agent.
 *
 * The AI runs the investigation itself: it decides which documents to read and
 * in what order, searches the file to follow leads, checks its own quotes, and
 * builds the report item by item through tools. Code does not choose its steps.
 * Code only enforces rules the agent cannot get around:
 *
 *  - Every quote is checked against the document the moment an item is recorded,
 *    and the agent is told at once if it cannot be found.
 *  - The report is accepted only when every page of every document has been read,
 *    every quote has been found, and every high-priority finding has a next step.
 *    Until then, submitting returns the list of problems to fix.
 *  - A limit on turns bounds the time and cost of a run.
 *  - None of the tools can send anything, contact anyone or change a record.
 */
import { z } from "zod";
import { locateQuote, normalise } from "../citations";
import type { AgentTool } from "../llm/provider";
import {
  CompletedItemSchema, FindingSchema, OutstandingItemSchema, OverviewSchema, RecoveryActionSchema, TimelineEventSchema,
  type CompletedItem, type Evidence, type Finding, type OutstandingItem, type RecoveryAction, type TakeoverReport, type TimelineEvent,
} from "../schemas";
import { REASONING_RULES, ROLE, SECTION_GUIDE, pageMarker, renderDocument, type PromptDocument } from "./prompts";
import { enforceCategoryBasis } from "./verify";

export type TrailKind = "thought" | "read" | "search" | "check" | "record" | "remove" | "submit";

/** One thing the agent did, in words a case manager can follow. */
export interface TrailEntry {
  kind: TrailKind;
  text: string;
  /** false when the action did not succeed (e.g. a quote not found, a rejected submission). */
  ok?: boolean;
}

type Item<T> = T & { id: string };

/** The report as the agent builds it. Plain data, so it can be saved and resumed. */
export interface InvestigatorState {
  overview: TakeoverReport["overview"] | null;
  findings: Finding[];
  timeline: Item<TimelineEvent>[];
  completedWork: CompletedItem[];
  outstandingWork: OutstandingItem[];
  recoveryPlan: RecoveryAction[];
  limitations: string[];
  /** Pages read per document (1-based). */
  pagesRead: Record<string, number[]>;
  submissions: number;
  accepted: boolean;
}

export const emptyState = (): InvestigatorState => ({
  overview: null, findings: [], timeline: [], completedWork: [], outstandingWork: [], recoveryPlan: [], limitations: [],
  pagesRead: {}, submissions: 0, accepted: false,
});

/** After this many rejected submissions the report is accepted anyway; the final check still removes anything unsupported. */
const MAX_SUBMISSIONS = 4;

export function investigatorSystem() {
  return `${ROLE}

You are running this investigation yourself, using tools. Work like a careful, experienced case manager on their first day with the file:
- Decide what to read and in what order. A good start is often the reassignment memo, CMS notes and task history, because they say what is supposed to be true. Then check those claims against the source documents.
- Follow leads. When something does not add up (a "Completed" task, a returned letter, a name or address that differs, a date that disagrees), search the file for every other mention and open the documents that settle it.
- Record what you establish as you go, with exact quotes. Each record is checked against the documents immediately and you are told if a quote cannot be found. Fix it by checking the exact wording and revising the item.
- Before each batch of tool calls, write one short plain-English sentence saying what you are checking in the case and why. The case manager watches these live. Write about the case only: never mention tools, parameters, ids, formats or errors in your own calls. If a call fails, fix it and carry on without comment. Do not write anything else outside tool calls.
- Make several independent tool calls in the same turn where you can (for example, read several documents at once, or record several items at once). Turns are limited.
- When the report is complete, call submit_report. If problems are listed, fix them and submit again.

Judging what matters most:
- Rank findings by how much each one affects the case if left alone, not only by category. Record the most consequential first, so F1 is the problem the case manager should understand first. Among high-priority findings, put first anything that could undermine the whole claim (for example, a filing or notice that names the wrong place, date or party, or evidence that may be lost), then problems that block assembling records, bills or insurance, then follow-ups.
- Give the most consequential finding its own recovery step, rather than folding it into a general note with other issues.
- Statements about fault are facts you can compare. If the memo, CMS or a letter says who was at fault, and a police report or other record says something different (for example, a different driver was cited), report it as a conflicting finding that quotes both. Do not decide who was at fault; the attorney does that.
- If a document in the file appears to belong to a different person (a different name, date of birth or address), say plainly that it may contain another person's private information. Say it must not be used or sent, and that it should go to the supervisor and attorney. Then request the client's correct record.

${REASONING_RULES}`;
}

export function investigatorPrompt(args: { caseContext: string; today: string; documents: PromptDocument[] }) {
  const list = args.documents
    .map((d) => `- ${d.id}: "${d.title}" (${d.category}; ${d.kind === "pdf" ? `PDF, ${d.pages.length} page${d.pages.length > 1 ? "s" : ""}` : "text"}${d.ocrPages?.length ? "; scanned, text from OCR" : ""})`)
    .join("\n");
  return `${args.caseContext}
Today's date: ${args.today}

The case file has ${args.documents.length} documents. They are the only sources you may rely on:
${list}

Your goal: produce a Case Takeover Report the incoming case manager can rely on. Build it with the record_* and set_* tools:
${Object.values(SECTION_GUIDE).join("\n")}

Ids: findings F1, F2...; completed work C1...; outstanding work O1...; actions A1...; timeline events E1.... Pass id null to add a new item (an id is assigned and returned), or an existing id to replace that item.
Evidence: docId is the document id; the quote is copied exactly from the document, preferably 5 to 30 words from a single page; page is the page number for PDFs and null otherwise.

You must read every page of every document before submitting. Begin.`;
}

/** Builds the tools. `log` receives a plain-language line for each action. */
export function investigatorTools(docs: PromptDocument[], state: InvestigatorState, log: (e: TrailEntry) => void): AgentTool[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const label = (id: string) => (byId.has(id) ? `${byId.get(id)!.title}` : id);

  /** Checks one item's quotes; returns a short report for the agent and the count that failed. */
  const checkEvidence = (evidence: Evidence[]) => {
    const lines: string[] = [];
    let bad = 0;
    evidence.forEach((e, i) => {
      const d = byId.get(e.docId);
      const m = d ? locateQuote(e.quote, d.pages) : null;
      if (m) lines.push(`quote ${i + 1}: found in ${e.docId}${d!.pages.length > 1 ? ` page ${m.page}` : ""}`);
      else {
        bad++;
        lines.push(`quote ${i + 1}: NOT FOUND in ${e.docId}${d ? "" : " (no such document)"}. Use check_quote or search_case_file to find the exact wording, then revise this item`);
      }
    });
    return { bad, text: lines.join("; ") };
  };

  const nextId = (prefix: string, items: { id: string }[]) => {
    const n = items.reduce((max, x) => Math.max(max, Number(x.id.slice(prefix.length)) || 0), 0);
    return `${prefix}${n + 1}`;
  };

  /** Shared add-or-replace logic for every list section. */
  function upsert<T extends { id: string; evidence: Evidence[] }>(
    list: T[], prefix: string, input: Omit<T, "id"> & { id: string | null }, describe: (x: T) => string,
    extra?: (x: T) => string | null,
  ) {
    const replacing = input.id !== null && list.some((x) => x.id === input.id);
    const id = replacing ? input.id! : nextId(prefix, list);
    const item = { ...input, id } as T;
    if (replacing) list.splice(list.findIndex((x) => x.id === id), 1, item);
    else list.push(item);
    const ev = checkEvidence(item.evidence);
    const more = extra?.(item);
    const ok = ev.bad === 0 && item.evidence.length > 0;
    log({ kind: "record", ok, text: `${replacing ? "Revised" : "Recorded"} ${id}: ${describe(item)}${ev.bad ? ` (${ev.bad} quote${ev.bad > 1 ? "s" : ""} not found)` : ""}` });
    const content = [
      `${replacing ? "Replaced" : "Recorded"} ${id}.`,
      item.evidence.length ? ev.text : "It has no evidence: add at least one quote or it will be dropped.",
      more,
    ].filter(Boolean).join(" ");
    return { content, isError: !ok };
  }

  const withId = <S extends z.ZodObject>(schema: S, what: string) =>
    schema.omit({ id: true } as never).extend({ id: z.string().nullable().describe(`null to add a new ${what}, or the id of an existing one to replace it`) });

  const readInput = z.object({
    docId: z.string(),
    pages: z.array(z.number()).nullable().describe("Page numbers to read (PDFs), or null for the whole document"),
  });
  const searchInput = z.object({ query: z.string().describe("A word, name, number or phrase. Case-insensitive.") });
  const quoteInput = z.object({ docId: z.string(), quote: z.string() });

  const tools: AgentTool[] = [
    {
      name: "read_document",
      description: "Read a document from the case file, whole or by page. Returns its text with page markers.",
      input: readInput,
      run: (raw) => {
        const { docId, pages } = raw as z.infer<typeof readInput>;
        const d = byId.get(docId);
        if (!d) return { content: `No document ${docId}. Documents: ${docs.map((x) => x.id).join(", ")}`, isError: true };
        const want = (pages?.length ? pages : d.pages.map((_, i) => i + 1)).filter((p) => p >= 1 && p <= d.pages.length);
        if (want.length === 0) return { content: `${docId} has ${d.pages.length} page(s).`, isError: true };
        state.pagesRead[docId] = [...new Set([...(state.pagesRead[docId] ?? []), ...want])].sort((a, b) => a - b);
        log({ kind: "read", text: `Read ${label(docId)}${d.kind === "pdf" ? ` (page${want.length > 1 ? "s" : ""} ${want.join(", ")})` : ""}${d.ocrPages?.some((p) => want.includes(p)) ? " — scanned, OCR text" : ""}` });
        if (d.kind !== "pdf" || want.length === d.pages.length) return { content: renderDocument(d) };
        const body = want.map((n) => `${pageMarker(d, n, d.pages[n - 1])}\n${d.pages[n - 1]}`).join("\n\n");
        return { content: `<document id="${d.id}" title="${d.title.replace(/"/g, "'")}" type="pdf" pages="${d.pages.length}" showing="${want.join(",")}">\n${body}\n</document>` };
      },
    },
    {
      name: "search_case_file",
      description: "Search every document for a word, name, number or phrase. Returns each matching line with its document and page. Use it to follow a lead across the file.",
      input: searchInput,
      run: (raw) => {
        const { query } = raw as z.infer<typeof searchInput>;
        const q = normalise(query).norm;
        if (q.length < 2) return { content: "Query too short.", isError: true };
        const words = q.split(" ").filter((w) => w.length > 1);
        const hits: string[] = [];
        let exact = true;
        const scan = (match: (line: string) => boolean) => {
          for (const d of docs)
            d.pages.forEach((p, i) => {
              for (const line of p.split("\n")) {
                if (line.trim() && match(normalise(line).norm))
                  hits.push(`${d.id}${d.pages.length > 1 ? ` p.${i + 1}` : ""}: ${line.trim().slice(0, 300)}`);
              }
            });
        };
        scan((l) => l.includes(q));
        if (hits.length === 0 && words.length > 1) {
          exact = false;
          scan((l) => words.every((w) => l.includes(w)));
        }
        const docsHit = new Set(hits.map((h) => h.split(/[: ]/)[0])).size;
        log({ kind: "search", ok: hits.length > 0, text: `Searched the file for “${query}” — ${hits.length ? `${hits.length} match${hits.length > 1 ? "es" : ""} in ${docsHit} document${docsHit > 1 ? "s" : ""}` : "no matches"}` });
        if (hits.length === 0) return { content: `No matches for "${query}".` };
        const shown = hits.slice(0, 40);
        return { content: `${exact ? "" : "No exact phrase match; lines containing all the words:\n"}${shown.join("\n")}${hits.length > shown.length ? `\n...and ${hits.length - shown.length} more. Narrow the search.` : ""}` };
      },
    },
    {
      name: "check_quote",
      description: "Check that a quote appears exactly in a document before relying on it. Returns the page if found.",
      input: quoteInput,
      run: (raw) => {
        const { docId, quote } = raw as z.infer<typeof quoteInput>;
        const d = byId.get(docId);
        const m = d ? locateQuote(quote, d.pages) : null;
        log({ kind: "check", ok: !!m, text: m ? `Confirmed a quote in ${label(docId)}` : `A quote was not found in ${label(docId)}; rechecking the wording` });
        if (!d) return { content: `No document ${docId}.`, isError: true };
        return m
          ? { content: `Found in ${docId}${d.pages.length > 1 ? ` on page ${m.page}` : ""}.` }
          : { content: `Not found in ${docId}. Quotes must be copied exactly. Re-read the page or search for a few distinctive words.`, isError: true };
      },
    },
    {
      name: "record_finding",
      description: "Add or replace a finding: an issue the incoming case manager must deal with, in exactly one category.",
      input: withId(FindingSchema, "finding"),
      run: (raw) => upsert(state.findings, "F", raw as Finding & { id: string | null }, (f) => f.title, (f) => {
        if (f.evidence.length === 0) return null;
        const { change } = enforceCategoryBasis({ ...f, evidence: f.evidence.filter((e) => byId.has(e.docId) && locateQuote(e.quote, byId.get(e.docId)!.pages)) });
        return change ? `Warning: ${change.reason} As recorded it would be shown as ${change.to.replace("_", " ")}. Either cite the statement of the gap, or change the category.` : null;
      }),
    },
    {
      name: "record_timeline_event",
      description: "Add or replace an event in the case timeline.",
      input: TimelineEventSchema.extend({ id: z.string().nullable().describe("null to add a new event, or an existing id (E1...) to replace it") }),
      run: (raw) => upsert(state.timeline, "E", raw as Item<TimelineEvent> & { id: string | null }, (t) => `${t.date} ${t.description}`),
    },
    {
      name: "record_completed_work",
      description: "Add or replace an item of completed work.",
      input: withId(CompletedItemSchema, "completed item"),
      run: (raw) => upsert(state.completedWork, "C", raw as CompletedItem & { id: string | null }, (c) => c.title),
    },
    {
      name: "record_outstanding_work",
      description: "Add or replace an item of outstanding work.",
      input: withId(OutstandingItemSchema, "outstanding item"),
      run: (raw) => upsert(state.outstandingWork, "O", raw as OutstandingItem & { id: string | null }, (o) => o.title),
    },
    {
      name: "record_action",
      description: "Add or replace a step in the recovery plan, with an optional draft. Nothing is sent: the case manager reviews every step.",
      input: withId(RecoveryActionSchema, "action"),
      run: (raw) => upsert(state.recoveryPlan, "A", raw as RecoveryAction & { id: string | null }, (a) => a.action),
    },
    {
      name: "set_overview",
      description: "Set (or replace) the case overview.",
      input: OverviewSchema,
      run: (raw) => {
        state.overview = raw as TakeoverReport["overview"];
        const o = state.overview;
        const ev = checkEvidence([...o.keyEvents, ...o.providers, ...o.insurance, o.lastMeaningfulActivity].flatMap((x) => x.evidence));
        log({ kind: "record", ok: ev.bad === 0, text: `Wrote the case overview${ev.bad ? ` (${ev.bad} quote${ev.bad > 1 ? "s" : ""} not found)` : ""}` });
        return { content: `Overview set. ${ev.bad ? ev.text : "All quotes found."}`, isError: ev.bad > 0 };
      },
    },
    {
      name: "set_limitations",
      description: "Set (or replace) the list of what the records do not establish.",
      input: z.object({ limitations: z.array(z.string()) }),
      run: (raw) => {
        state.limitations = (raw as { limitations: string[] }).limitations;
        log({ kind: "record", text: `Listed ${state.limitations.length} open question${state.limitations.length === 1 ? "" : "s"} the records do not settle` });
        return { content: `Limitations set (${state.limitations.length}).` };
      },
    },
    {
      name: "remove_item",
      description: "Withdraw an item you recorded (F#, E#, C#, O# or A#), for example if the evidence does not support it.",
      input: z.object({ id: z.string() }),
      run: (raw) => {
        const { id } = raw as { id: string };
        for (const list of [state.findings, state.timeline, state.completedWork, state.outstandingWork, state.recoveryPlan] as { id: string }[][]) {
          const i = list.findIndex((x) => x.id === id);
          if (i >= 0) {
            list.splice(i, 1);
            log({ kind: "remove", text: `Withdrew ${id}` });
            return { content: `Removed ${id}.` };
          }
        }
        return { content: `No item ${id}.`, isError: true };
      },
    },
    {
      name: "submit_report",
      description: "Submit the report. It is accepted only if every document has been read in full and every item is supported; otherwise the problems are listed for you to fix.",
      input: z.object({}),
      run: () => {
        state.submissions++;
        const problems = gateProblems(docs, state);
        if (problems.length === 0 || state.submissions >= MAX_SUBMISSIONS) {
          state.accepted = true;
          log({ kind: "submit", ok: true, text: problems.length ? `Submitted the report with ${problems.length} unresolved problem${problems.length > 1 ? "s" : ""}; the final check removes anything unsupported` : "Submitted the report — all checks passed" });
          return { content: "Report accepted. You are done." };
        }
        log({ kind: "submit", ok: false, text: `Tried to submit — ${problems.length} problem${problems.length > 1 ? "s" : ""} to fix first` });
        return { content: `Not accepted yet (attempt ${state.submissions} of ${MAX_SUBMISSIONS}). Fix these and submit again:\n- ${problems.slice(0, 30).join("\n- ")}`, isError: true };
      },
    },
  ];
  return tools;
}

/** What stops the report being accepted. */
export function gateProblems(docs: PromptDocument[], s: InvestigatorState): string[] {
  const p: string[] = [];
  for (const d of docs) {
    const read = new Set(s.pagesRead[d.id] ?? []);
    const unread = d.pages.map((_, i) => i + 1).filter((n) => !read.has(n) && d.pages[n - 1].trim());
    if (unread.length) p.push(`${d.id} ("${d.title}") not read${d.pages.length > 1 ? `: page${unread.length > 1 ? "s" : ""} ${unread.join(", ")}` : ""}`);
  }
  if (!s.overview) p.push("No overview: call set_overview");
  const byId = new Map(docs.map((d) => [d.id, d]));
  const badQuotes = (ev: Evidence[]) => ev.filter((e) => !byId.has(e.docId) || !locateQuote(e.quote, byId.get(e.docId)!.pages)).length;
  const sections: [string, { id: string; evidence: Evidence[] }[]][] = [
    ["finding", s.findings], ["timeline event", s.timeline], ["completed item", s.completedWork], ["outstanding item", s.outstandingWork], ["action", s.recoveryPlan],
  ];
  for (const [what, list] of sections)
    for (const x of list) {
      const bad = badQuotes(x.evidence);
      if (bad) p.push(`${what} ${x.id}: ${bad} quote${bad > 1 ? "s" : ""} not found in the cited document`);
      else if (x.evidence.length === 0 && !(what === "action" && (x as RecoveryAction).relatedFindingIds.length)) p.push(`${what} ${x.id}: no evidence`);
    }
  if (s.overview) {
    const o = s.overview;
    const bad = badQuotes([...o.keyEvents, ...o.providers, ...o.insurance, o.lastMeaningfulActivity].flatMap((x) => x.evidence));
    if (bad) p.push(`overview: ${bad} quote${bad > 1 ? "s" : ""} not found`);
  }
  const ids = new Set(s.findings.map((f) => f.id));
  for (const x of [...s.timeline, ...s.outstandingWork, ...s.recoveryPlan])
    for (const r of x.relatedFindingIds) if (!ids.has(r)) p.push(`${x.id} refers to ${r}, which does not exist`);
  for (const f of s.findings) {
    if (f.priority === "high" && !s.recoveryPlan.some((a) => a.relatedFindingIds.includes(f.id))) p.push(`high-priority finding ${f.id} has no recovery action`);
    const verified = { ...f, evidence: f.evidence.filter((e) => byId.has(e.docId) && locateQuote(e.quote, byId.get(e.docId)!.pages)) };
    const { change } = enforceCategoryBasis(verified);
    if (change) p.push(`finding ${f.id} is "confirmed incomplete", but ${change.reason.replace(/^Marked "confirmed incomplete", but /, "")} Cite the statement of the gap, or change the category`);
  }
  if (s.recoveryPlan.length === 0) p.push("No recovery plan: record at least one action");
  return p;
}

/** The finished report, in the shared report format. */
export function stateToReport(s: InvestigatorState): TakeoverReport {
  const overview = s.overview ?? {
    caseType: "", currentStage: "", summary: "No overview was written.", keyEvents: [], providers: [], insurance: [],
    lastMeaningfulActivity: { date: "", description: "", evidence: [] },
  };
  return {
    overview,
    timeline: s.timeline.map(({ id: _, ...t }) => t),
    findings: s.findings,
    completedWork: s.completedWork,
    outstandingWork: s.outstandingWork,
    recoveryPlan: [...s.recoveryPlan].sort((a, b) => a.order - b.order),
    limitations: s.limitations,
  };
}
