/**
 * Deterministic citation verification.
 *
 * Every piece of evidence in a report is checked against the raw extracted text
 * of the document it cites. Evidence that cannot be matched is removed. Any
 * finding, timeline event, completed/outstanding item or action left with no
 * verified evidence is rejected and listed separately, so nothing unsupported
 * is shown as fact.
 */
import { locateQuote } from "../citations";
import type { Evidence, Finding, FindingCategory, TakeoverReport } from "../schemas";

export interface RemovedCitation {
  location: string;
  docId: string;
  quote: string;
  reason: "unknown_document" | "quote_not_found";
}

export interface RejectedItem {
  section: "timeline" | "findings" | "completedWork" | "outstandingWork" | "recoveryPlan" | "overview";
  id: string | null;
  title: string;
  reason: string;
}

export interface RecategorisedFinding {
  id: string;
  title: string;
  from: FindingCategory;
  to: FindingCategory;
  reason: string;
}

export interface VerificationSummary {
  totalCitations: number;
  verifiedCitations: number;
  removedCitations: RemovedCitation[];
  rejectedItems: RejectedItem[];
  /** Findings whose category was corrected by the consistency rule. Absent on older runs. */
  recategorised?: RecategorisedFinding[];
}

const BASIS_TEXT: Record<string, string> = {
  no_record_found: "it rests on the absence of a record (or only an open task)",
  outcome_not_shown: "it rests on an action whose outcome is not shown",
  sources_disagree: "it rests on sources that disagree",
};

/**
 * Wording that states a gap: "Not yet requested", "had not been finalized",
 * "outstanding", "partial", "never sent", "must be requested directly"...
 * A heuristic: it backs up the model's own categoryBasis, which the model can get wrong
 * (e.g. calling an open "Return client voicemail" task a document that states the gap).
 */
export const GAP_WORDING =
  /\b(not yet|not been|had not|has not|have not|was not|were not|not (requested|received|included|provided|sent|released|confirmed|finalized|available|on file)|never|partial(ly)?|incomplete|missing|outstanding|pending|no response|none received|withheld|must be requested)\b/i;

/**
 * Consistency rule: "confirmed incomplete" must rest on a document that states
 * the gap. Anything else is downgraded: absence of a record is not proof.
 *  1. The model's categoryBasis must be document_states_gap.
 *  2. At least one cited excerpt must actually contain gap wording (GAP_WORDING).
 * Run on verified evidence only. Older reports without categoryBasis are left unchanged.
 */
export function enforceCategoryBasis(f: Finding): { finding: Finding; change: RecategorisedFinding | null } {
  if (f.category !== "confirmed_incomplete" || !f.categoryBasis) return { finding: f, change: null };
  const statesGap = f.evidence.some((e) => GAP_WORDING.test(e.quote));
  if (f.categoryBasis === "document_states_gap" && statesGap) return { finding: f, change: null };
  const absence = f.categoryBasis === "no_record_found" || f.categoryBasis === "document_states_gap";
  const to: FindingCategory =
    f.categoryBasis === "sources_disagree" ? "conflicting"
    : absence && (f.gapType === "missing_document" || f.gapType === "missing_request") ? "potentially_incomplete"
    : "unverified";
  const reason = f.categoryBasis === "document_states_gap"
    ? `Marked "confirmed incomplete", but none of its cited excerpts states the gap.`
    : `Marked "confirmed incomplete", but ${BASIS_TEXT[f.categoryBasis]}, not on a document that states the gap.`;
  return { finding: { ...f, category: to }, change: { id: f.id, title: f.title, from: f.category, to, reason } };
}

export type DocumentPages = Map<string, string[]>;

export function verifyReport(
  report: TakeoverReport,
  docs: DocumentPages,
): { report: TakeoverReport; verification: VerificationSummary } {
  const summary: VerificationSummary = {
    totalCitations: 0,
    verifiedCitations: 0,
    removedCitations: [],
    rejectedItems: [],
    recategorised: [],
  };

  const check = (evidence: Evidence[], location: string): Evidence[] => {
    const kept: Evidence[] = [];
    for (const e of evidence) {
      summary.totalCitations++;
      const pages = docs.get(e.docId);
      if (!pages) {
        summary.removedCitations.push({ location, docId: e.docId, quote: e.quote, reason: "unknown_document" });
        continue;
      }
      const match = locateQuote(e.quote, pages);
      if (!match) {
        summary.removedCitations.push({ location, docId: e.docId, quote: e.quote, reason: "quote_not_found" });
        continue;
      }
      summary.verifiedCitations++;
      // Page comes from the match, never from the model.
      kept.push({ ...e, page: pages.length > 1 ? match.page : null });
    }
    return kept;
  };

  const reject = (section: RejectedItem["section"], id: string | null, title: string) =>
    summary.rejectedItems.push({ section, id, title, reason: "No supporting citation could be verified against the source documents." });

  // Overview
  const o = report.overview;
  const overview = {
    ...o,
    keyEvents: o.keyEvents
      .map((k) => ({ ...k, evidence: check(k.evidence, `overview.keyEvents: ${k.description}`) }))
      .filter((k) => k.evidence.length > 0 || (reject("overview", null, k.description), false)),
    providers: o.providers
      .map((p) => ({ ...p, evidence: check(p.evidence, `overview.providers: ${p.name}`) }))
      .filter((p) => p.evidence.length > 0 || (reject("overview", null, p.name), false)),
    insurance: o.insurance
      .map((i) => ({ ...i, evidence: check(i.evidence, `overview.insurance: ${i.carrier}`) }))
      .filter((i) => i.evidence.length > 0 || (reject("overview", null, i.carrier), false)),
    lastMeaningfulActivity: {
      ...o.lastMeaningfulActivity,
      evidence: check(o.lastMeaningfulActivity.evidence, "overview.lastMeaningfulActivity"),
    },
  };

  const findings = report.findings
    .map((f) => ({ ...f, evidence: check(f.evidence, `finding ${f.id}: ${f.title}`) }))
    .filter((f) => f.evidence.length > 0 || (reject("findings", f.id, f.title), false))
    // After citation checking, so the rule only trusts excerpts that really are in the documents.
    .map((f) => {
      const { finding, change } = enforceCategoryBasis(f);
      if (change) summary.recategorised!.push(change);
      return finding;
    });
  const findingIds = new Set(findings.map((f) => f.id));
  const keepIds = (ids: string[]) => ids.filter((id) => findingIds.has(id));

  const timeline = report.timeline
    .map((t) => ({ ...t, evidence: check(t.evidence, `timeline ${t.date}: ${t.description}`), relatedFindingIds: keepIds(t.relatedFindingIds) }))
    .filter((t) => t.evidence.length > 0 || (reject("timeline", null, `${t.date} — ${t.description}`), false))
    .sort((a, b) => a.date.localeCompare(b.date));

  const completedWork = report.completedWork
    .map((c) => ({ ...c, evidence: check(c.evidence, `completed ${c.id}: ${c.title}`) }))
    .filter((c) => c.evidence.length > 0 || (reject("completedWork", c.id, c.title), false));

  const outstandingWork = report.outstandingWork
    .map((w) => ({ ...w, evidence: check(w.evidence, `outstanding ${w.id}: ${w.title}`), relatedFindingIds: keepIds(w.relatedFindingIds) }))
    .filter((w) => w.evidence.length > 0 || (reject("outstandingWork", w.id, w.title), false));

  // An action is kept if it has its own verified evidence or links to a surviving finding.
  const recoveryPlan = report.recoveryPlan
    .map((a) => ({ ...a, evidence: check(a.evidence, `action ${a.id}: ${a.action}`), relatedFindingIds: keepIds(a.relatedFindingIds) }))
    .filter((a) => a.evidence.length > 0 || a.relatedFindingIds.length > 0 || (reject("recoveryPlan", a.id, a.action), false))
    .sort((a, b) => a.order - b.order);

  return {
    report: { ...report, overview, findings, timeline, completedWork, outstandingWork, recoveryPlan },
    verification: summary,
  };
}
