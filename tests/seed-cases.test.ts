/**
 * Checks the seeded case files: every listed document exists, is marked
 * fictional, extracts to text, and the key facts a good report must cite can be
 * quoted exactly (so citation verification will accept them).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "cta-seed-"));
  process.env.DATA_DIR = tmp;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const load = async () => {
  vi.resetModules();
  return { ...(await import("@/lib/store")), ...(await import("@/lib/extract")), ...(await import("@/lib/citations")) };
};

const BANNER = "FICTIONAL DEMO RECORD";

/** Facts a good report must be able to cite, per case: [docId, exact quote]. */
const MUST_CITE: Record<string, [string, string][]> = {
  "cw-2025-0911": [
    ["doc-05", "Pinecrest Casualty accepts liability for this loss on behalf of our insured at 100%."],
    ["doc-05", "$100,000 per person and $300,000 per accident"],
    ["doc-06", "Patient has reached maximum medical improvement. Released from care."],
    ["doc-08", "All requests complete. No outstanding records or bills as of 04/10/2026."],
    ["doc-04", "Final lien amount: Requested from Meridian on 09/24/2026. Response pending."],
  ],
  "cw-2026-0233": [
    ["doc-02", "Date/time of bite: 09/12/2026, approx. 18:40"],
    ["doc-04", "Dog bite to left forearm yesterday evening (09/12) by neighbor's dog."],
    ["doc-01", "Date: 09/14/2026 (per client), early evening"],
    ["doc-07", "RESULT: NO ANSWER — NOT SENT"],
    ["doc-12", "T-0233-02 | Request records & bills — QuickMed Express Urgent Care | Assigned: D. Whitfield | Created 09/17/2026 | Due 09/30/2026 | Status: Completed"],
    ["doc-05", "Bills: Not yet requested"],
    ["doc-11", "Not confirmed; no policy or claim number."],
    ["doc-14", "Insurer: Evergreen Mutual"],
    ["doc-02", "10-day home observation (quarantine) ordered, ending 09/22/2026."],
  ],
  "cw-2026-0198": [
    ["doc-10", "Unclaimed — being returned to sender"],
    ["doc-14", "T-0198-02 | Send evidence preservation letter — Ridgeline Freight | Assigned: D. Whitfield | Created 08/27/2026 | Due 08/28/2026 | Status: Completed | Completed 08/28/2026"],
    ["doc-16", "Preservation letter sent to Ridgeline Freight on 08/28, so the truck data is protected."],
    ["doc-08", "Atlas does not insure Ridgeline Freight LLC, the motor carrier, or its driver."],
    ["doc-11", "Physical address: 88 Quarry Road, Unit B, Brookfield"],
    ["doc-02", "Carrier address (from cab paperwork): 210 Commerce Drive, Brookfield"],
    ["doc-09", "This request is under utilization review."],
    ["doc-12", "workers' comp \"denied\" his back surgery"],
  ],
};

describe("seeded cases", () => {
  it("lists every case with a real document count; cases without a file can still be opened", async () => {
    const { listCases, getCase } = await load();
    const cases = await listCases();
    expect(cases.length).toBeGreaterThanOrEqual(8);
    const count = Object.fromEntries(cases.map((c) => [c.id, c.documentCount]));
    expect(count["cw-2026-0187"]).toBe(15);
    expect(count["cw-2025-0911"]).toBe(14);
    expect(count["cw-2026-0233"]).toBe(14);
    expect(count["cw-2026-0198"]).toBe(16);
    expect(count["cw-2026-0142"]).toBe(0);
    const empty = await getCase("cw-2026-0142");
    expect(empty).toMatchObject({ documents: [], assignedAttorney: "Priya Natarajan", reassignedOn: "2026-10-31" });
    expect(empty!.firm).toMatch(/fictional/);
  });

  for (const caseId of ["cw-2026-0187", "cw-2025-0911", "cw-2026-0233", "cw-2026-0198"]) {
    it(`${caseId}: every document exists, is marked fictional and extracts`, { timeout: 60_000 }, async () => {
      const { getCase, readDocumentBytes, extractPages, locateQuote } = await load();
      const c = (await getCase(caseId))!;
      const ids = c.documents.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      const pages = new Map<string, string[]>();
      for (const d of c.documents) {
        const scanned = /-fax\.pdf$/.test(d.filename);
        const x = await extractPages(await readDocumentBytes(caseId, d), d.kind, { ocr: scanned });
        if (scanned) expect(x.ocrPages.length, d.filename).toBe(x.pages.length);
        expect(x.pages.join("").length, d.filename).toBeGreaterThan(200);
        expect(x.pages.join("\n"), d.filename).toContain(BANNER);
        pages.set(d.id, x.pages);
      }
      for (const [docId, quote] of MUST_CITE[caseId] ?? []) {
        expect(locateQuote(quote, pages.get(docId)!), `${docId}: ${quote}`).not.toBeNull();
      }
    });
  }

  it("test notes stay out of the case file", async () => {
    const { getCase } = await load();
    for (const id of ["cw-2025-0911", "cw-2026-0233", "cw-2026-0198"]) {
      const c = (await getCase(id))!;
      expect(c.documents.some((d) => /TEST-NOTES/i.test(d.filename))).toBe(false);
      expect(await readFile(path.join("seed/cases", id, "TEST-NOTES.md"), "utf8")).toMatch(/agent never sees this/);
    }
  });
});
