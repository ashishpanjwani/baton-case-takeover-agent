/**
 * Consistency rule: "confirmed incomplete" must rest on a document that states
 * the gap. Absence of a record (or an open task alone) is downgraded.
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractPages } from "@/lib/extract";
import { kindFor } from "@/lib/store";
import { getDemoReport } from "@/lib/agent/demo-report";
import { enforceCategoryBasis, verifyReport } from "@/lib/agent/verify";
import type { Finding } from "@/lib/schemas";

const ev = (quote: string) => ({ docId: "doc-05", quote, page: null, note: null });
const base: Finding = {
  id: "F1", category: "confirmed_incomplete", categoryBasis: "document_states_gap", gapType: "missing_request",
  title: "t", explanation: "e", priority: "high", operationalImpact: "o", evidence: [ev("Records: Not yet requested")], couldNotEstablish: null, recommendedNextStep: "n",
};
const run = (f: Partial<Finding>) => enforceCategoryBasis({ ...base, ...f });

describe("category basis rule", () => {
  it("keeps confirmed incomplete when a document states the gap", () => {
    expect(run({}).change).toBeNull();
    expect(run({}).finding.category).toBe("confirmed_incomplete");
  });

  it("downgrades absence-of-record findings by gap type", () => {
    // e.g. a provider the client mentioned but nobody tracked
    expect(run({ categoryBasis: "no_record_found", gapType: "missing_request" }).finding.category).toBe("potentially_incomplete");
    expect(run({ categoryBasis: "no_record_found", gapType: "missing_document" }).finding.category).toBe("potentially_incomplete");
    // e.g. an open callback task with no logged call
    expect(run({ categoryBasis: "no_record_found", gapType: "other" }).finding.category).toBe("unverified");
    expect(run({ categoryBasis: "outcome_not_shown", gapType: "unverified_outcome" }).finding.category).toBe("unverified");
    expect(run({ categoryBasis: "sources_disagree" }).finding.category).toBe("conflicting");
    expect(run({ categoryBasis: "no_record_found" }).change).toMatchObject({ id: "F1", from: "confirmed_incomplete", to: "potentially_incomplete" });
  });

  it("downgrades a claimed document_states_gap when no cited excerpt states the gap", () => {
    // The real case: an open callback task presented as a document stating the gap.
    const voicemail = run({
      gapType: "other",
      evidence: [ev("VM from client asking for an update on her case and whether she needs to send us anything. Callback needed."), ev("Return client voicemail")],
    });
    expect(voicemail.finding.category).toBe("unverified");
    expect(voicemail.change?.reason).toMatch(/none of its cited excerpts states the gap/);
    // Gap wording seen in the seeded documents keeps the label.
    for (const q of [
      "UM/UIM: Client reports she has UM/UIM coverage. Limits not yet confirmed.",
      "The office note for date of service 04/29/2026 had not been finalized by the treating provider",
      "Itemized billing statements are maintained by our billing office and must be requested directly",
      "Emailed Harborview Ortho ROI re: outstanding 04/29 note.",
    ]) expect(run({ evidence: [ev(q)] }).change, q).toBeNull();
  });

  it("never touches other categories, or older reports without a basis", () => {
    expect(run({ category: "unverified", categoryBasis: "no_record_found" }).change).toBeNull();
    expect(run({ categoryBasis: undefined as unknown as Finding["categoryBasis"] }).change).toBeNull();
  });

  it("records corrections in the verification summary; the demo report needs none", async () => {
    // The rule runs on verified evidence, so verify against the real seed documents.
    const dir = "seed/cases/cw-2026-0187";
    const manifest = JSON.parse(await readFile(`${dir}/case.json`, "utf8")) as { documents: { id: string; filename: string }[] };
    const docs = new Map<string, string[]>();
    for (const d of manifest.documents) docs.set(d.id, (await extractPages(await readFile(`${dir}/documents/${d.filename}`), kindFor(d.filename), { ocr: false })).pages);
    const demo = getDemoReport("cw-2026-0187")!;
    expect(demo.findings.every((f) => f.categoryBasis)).toBe(true);
    const extra = { ...demo.findings[1], id: "F50", categoryBasis: "no_record_found" as const, gapType: "other" as const };
    const { verification } = verifyReport({ ...demo, findings: [...demo.findings, extra] }, docs);
    expect(verification.recategorised).toEqual([expect.objectContaining({ id: "F50", to: "unverified" })]);
    expect(verifyReport(demo, docs).verification.recategorised).toEqual([]);
  });
});
