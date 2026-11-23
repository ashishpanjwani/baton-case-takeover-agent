/**
 * Prompts for the investigation. The reasoning rules here are the product's
 * credibility; change them deliberately.
 */
import type { DocumentAnalysis, ReportPart1 } from "../schemas";

export interface PromptDocument {
  id: string;
  title: string;
  category: string;
  kind: "pdf" | "text";
  pages: string[];
  /** 1-based pages whose text came from OCR of a scanned image. */
  ocrPages?: number[];
}

export const ROLE = `You are an experienced operations-focused case assistant at a US plaintiff-side personal injury law firm. A case is being handed to a new case manager because the previous case manager left. Your job is to reconstruct the case's operational history from the supplied documents and identify what work is complete, outstanding, unverified or conflicting.

You are not a lawyer. Never give legal advice, assess liability, estimate case or settlement value, or recommend legal strategy. When something needs a legal judgment, say it should go to the assigned attorney and stop there.`;

export const REASONING_RULES = `Reasoning rules (these are strict):
1. Use only facts stated in the supplied documents. Never invent facts, dates, providers, documents, amounts or communications.
2. Every factual statement you make must be supported by evidence: a verbatim excerpt from a specific document. Copy excerpts character-for-character. Citations are checked automatically against the documents, and anything that cannot be matched is discarded.
3. The absence of a record is not proof that work was not done. Say "the supplied documents do not show..." rather than "X was never done".
4. Distinguish carefully between: a missing document (work may have happened, but the document is not in the file), a missing request (no evidence a request was ever made), and an unverified outcome (a request was made or a task marked complete, but the result is not evidenced).
5. When sources conflict, report the conflict and cite both sides. Do not pick a winner.
6. A task marked "Completed" in the CMS shows only that someone closed the task. Look for evidence that the intended outcome was achieved, such as the records themselves or a confirming letter. Treat a CMS note as weaker evidence than the underlying document it describes.
7. A gap in recent activity is not evidence of neglect. Do not suggest that anyone was negligent or at fault.
8. Do not draw legal conclusions.
9. When the evidence is insufficient, say so plainly, e.g. "Not established from the supplied records." Write about the case, not about yourself: never use "I" outside drafts written for the case manager to send.
10. Do not invent findings to make the report look useful. Work that is complete and well-evidenced should be reported as complete.
11. Pages marked "text from OCR" were read from a scanned image and may contain recognition errors. Quote them exactly as they appear, including any errors. If a date, amount or name on such a page looks garbled or ambiguous, say it could not be read reliably rather than guessing.`;

export function renderDocument(d: PromptDocument): string {
  const body =
    d.kind === "pdf"
      ? d.pages.map((p, i) => `${pageMarker(d, i + 1, p)}\n${p}`).join("\n\n")
      : d.pages.join("\n");
  return `<document id="${d.id}" title="${escapeAttr(d.title)}" category="${escapeAttr(d.category)}" type="${d.kind}" pages="${d.pages.length}">\n${body}\n</document>`;
}

function pageMarker(d: PromptDocument, n: number, text: string) {
  if (!text.trim()) return `[Page ${n} — no text could be extracted from this page]`;
  if (d.ocrPages?.includes(n)) return `[Page ${n} — text from OCR of a scanned image; may contain recognition errors]`;
  return `[Page ${n}]`;
}

const escapeAttr = (s: string) => s.replace(/"/g, "'");

export function documentAnalysisPrompt(d: PromptDocument, caseContext: string): string {
  return `${caseContext}

Read this single document from the case file and extract its operational content.

${renderDocument(d)}

Extract:
- events: every dated event the document records (what happened, when). Use YYYY-MM-DD dates.
- workItems: every request, task, follow-up, enclosure or deliverable mentioned, with its status exactly as this document records it.
- referencedEntities: providers, insurers, people and other documents referenced.

Every "quote" must be copied verbatim from the document above. Set docId to "${d.id}". Do not draw conclusions across documents; that happens later.`;
}

const SECTION_GUIDE = {
  overview: `- overview: case type, current stage, a short operational summary, key events, known providers (with what the file shows about their records and bills), insurance information, and the last meaningful activity.`,
  timeline: `- timeline: a chronological reconstruction of the case's operational history. One entry per meaningful event, each with evidence. Link timeline entries to finding ids where relevant.`,
  findings: `- findings: issues that need the incoming case manager's attention, each in exactly one category:
    confirmed_incomplete: a cited document itself states the gap, for example a provider list entry "Not yet requested", a provider letter saying records are partial or an item is "not included", or a note saying a bill was "never sent". Cite that statement. categoryBasis must be document_states_gap.
    potentially_incomplete: the documents suggest something may be missing (for example, a provider the client mentions but nobody tracked), but no document states the gap.
    unverified: the documents do not show whether the work was done or achieved its outcome. An open CMS task with no later record of the work is unverified, not confirmed incomplete: the work may have been done and not logged.
    conflicting: two or more sources disagree. Cite each side.
  Test before choosing confirmed_incomplete: if the work might have been done without leaving a record in the supplied documents, and no document says it was not done, the finding is potentially_incomplete or unverified.
  For each finding, set categoryBasis and gapType, and say what you could not establish. Priorities reflect operational urgency (for example, whether it blocks assembling complete records and bills, or whether a client is waiting on a response).`,
  completedWork: `- completedWork: work that appears complete. Use basis "outcome_documented" only when a document shows the result, such as records in the file or a confirmation letter. Use "action_documented" when the action is evidenced but the outcome is not yet confirmed. Do not list work as complete on the strength of a CMS task status alone.`,
  outstandingWork: `- outstandingWork: pending requests, unresolved follow-ups and open items. Mark each "confirmed_outstanding" or "status_unknown". Link each to related finding ids.`,
  recoveryPlan: `- recoveryPlan: a prioritised list of concrete next steps, ordered by what to do first. For each, give the suggested owner (the incoming case manager by default; the assigned attorney for anything that needs legal judgment). Anything that would contact a third party or the client, or change a record, has requiresApproval=true. Where useful, include a short draft (email, letter, call script or internal note) that uses only facts from the documents and puts anything unknown in [brackets]. Link each action to the finding ids it addresses.`,
  limitations: `- limitations: what the supplied records do not establish. One item per topic, each written as "Topic: what is not established, and why", e.g. "BI policy limits: not verified. The declarations page is not in the package and the insurer's written response is pending (F2)." Start with the topic in a few words, use a neutral voice (no "I"), and put related finding ids in parentheses. Leave out general disclaimers about legal advice or case value; the report adds those itself.`,
};

/**
 * The report is produced in two reasoning calls (the full schema is too large
 * for one structured-output grammar). Part 1: overview, timeline, findings.
 * Part 2: completed work, outstanding work, recovery plan and limitations,
 * built on part 1's findings so ids line up.
 */
export function synthesisPrompt(args: {
  caseContext: string;
  today: string;
  documents: PromptDocument[];
  analyses: DocumentAnalysis[];
  part: 1 | 2;
  part1?: ReportPart1;
}): string {
  const sections: (keyof typeof SECTION_GUIDE)[] = args.part === 1
    ? ["overview", "timeline", "findings"]
    : ["completedWork", "outstandingWork", "recoveryPlan", "limitations"];
  const task = args.part === 1
    ? `Produce part 1 of 2 of the Case Takeover Report for the incoming case manager: the overview, the timeline and the findings. A later step uses your findings to write the completed work, outstanding work and recovery plan, so make the findings complete.`
    : `Produce part 2 of 2 of the Case Takeover Report for the incoming case manager: completed work, outstanding work, the recovery plan and limitations.

Part 1 (overview, timeline and findings) has already been written from the same documents. Its findings are below. Build on them: refer to them by id in relatedFindingIds, give every high-priority finding at least one recovery action, and keep your statements consistent with them. Do not invent new finding ids. If you notice an issue the findings do not cover, describe it in an outstanding item or a limitation, with evidence.
<part1_findings>
${JSON.stringify(args.part1?.findings ?? [])}
</part1_findings>`;
  return `${args.caseContext}
Today's date: ${args.today}

The complete supplied case file follows. These are the only sources you may rely on.

${args.documents.map(renderDocument).join("\n\n")}

Per-document extraction notes from an earlier pass (for orientation only; cite the documents themselves, not these notes):
<extraction_notes>
${JSON.stringify(args.analyses)}
</extraction_notes>

${task}

Sections:
${sections.map((s) => SECTION_GUIDE[s]).join("\n")}

Evidence: docId is the document's id attribute. The quote is a verbatim excerpt from that document, preferably 5 to 30 words from a single page. page is the page number for PDFs and null otherwise.

${REASONING_RULES}`;
}

export function caseContext(c: {
  clientName: string; reference: string; caseType: string; stage: string; previousCaseManager: string; assignedAttorney: string | null;
}): string {
  return `Case: ${c.clientName} (${c.reference}). Case type as recorded: ${c.caseType}. Stage as recorded: ${c.stage}. Previous case manager: ${c.previousCaseManager}. Assigned attorney: ${c.assignedAttorney ?? "unknown"}.`;
}
