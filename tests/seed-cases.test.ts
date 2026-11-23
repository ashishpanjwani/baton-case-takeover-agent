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
  "cw-2026-0251": [
    ["doc-04", "We have not received the signed Proof of Loss requested on 08/14/2026"],
    ["doc-05", "Signature of insured: ______________________"],
    ["doc-12", "T-0251-04 | Return signed Proof of Loss to Bayline | Assigned: D. Whitfield | Created 08/14/2026 | Due 10/13/2026 | Status: Completed | Completed 09/02/2026"],
    ["doc-08", "Harbor General Hospital — Emergency | 07/09/2026 | $6,240.00"],
    ["doc-02", "No suspect has been identified. Investigation suspended pending new leads."],
    ["doc-14", "police have identified the driver"],
  ],
  "cw-2026-0266": [
    ["doc-05", "Patient: Mariela Gonzales"],
    ["doc-05", "Right ankle pain after twisting it playing soccer yesterday."],
    ["doc-03", "DOB: 11/23/1988"],
    ["doc-06", "Our records show that the driver ended the trip at 9:41 PM"],
    ["doc-04", "Drop-off: 560 Fulton Street — 9:52 PM"],
    ["doc-02", "Unit 2 driver cited: Failure to obey traffic signal."],
    ["doc-13", "Liability: Glide driver at fault."],
  ],
  "cw-2025-0874": [
    ["doc-04", "Place: Public sidewalk in front of 221 Market Street, Harborview"],
    ["doc-02", "Building number \"212\" visible above the bakery door"],
    ["doc-10", "Harbor Physical Therapy | $3,150.00"],
    ["doc-08", "Total charges: $3,510.00"],
    ["doc-06", "This acknowledgment is not an admission of liability."],
    ["doc-09", "This is not a final demand."],
    ["doc-15", "Medicare: lien resolved."],
  ],
  "cw-2026-0281": [
    ["doc-05", "The authorization received is signed by the patient only."],
    ["doc-05", "No records or bills have been released."],
    ["doc-12", "Harbor Children's and Bayside records requested and received."],
    ["doc-04", "The check was mailed to 72 Orchard Lane on 09/18/2026."],
    ["doc-08", "she deposited it into her own account last week"],
    ["doc-12", "Medical payments: $5,000 check from Crescent still pending."],
    ["doc-02", "Aisle 7 (canned goods and condiments), near the end cap."],
    ["doc-01", "near the dairy case in aisle 4"],
    ["doc-04", "has been preserved by FreshWay Risk Management (reference FW-RM-8812)"],
  ],
  "cw-2026-0290": [
    ["doc-04", "Derek Voss: 1 potential match — CURRENT CLIENT."],
    ["doc-04", "Do not proceed on the new matter until cleared."],
    ["doc-13", "Conflicts cleared; engagement in place."],
    ["doc-01", "Firm countersignature pending conflict check."],
    ["doc-05", "If we do not receive the claim form within 30 days of the date of this letter, we will close our file."],
    ["doc-05", "The renter declined the optional supplemental liability insurance at the time of rental."],
  ],
  "cw-2026-0219": [
    ["doc-07", "Benefit checks are now mailed to 2290 Ferry Road, Apt 5."],
    ["doc-10", "Moved, left no address"],
    ["doc-14", "Client: in regular contact."],
    ["doc-06", "We believe you may have the wrong company."],
    ["doc-02", "Scaffold erected and maintained by Ironside Scaffolding Inc. (scaffolding subcontractor)."],
    ["doc-05", "We have not accepted liability for this loss"],
    ["doc-09", "Discharged for non-attendance. Goals not met."],
  ],
};

describe("seeded cases", () => {
  it("lists every case with a real document count; cases without a file can still be opened", async () => {
    const { listCases, getCase } = await load();
    const cases = await listCases();
    expect(cases.length).toBeGreaterThanOrEqual(15);
    const count = Object.fromEntries(cases.map((c) => [c.id, c.documentCount]));
    expect(count["cw-2026-0187"]).toBe(15);
    expect(count["cw-2025-0911"]).toBe(14);
    expect(count["cw-2026-0233"]).toBe(14);
    expect(count["cw-2026-0198"]).toBe(16);
    expect(count["cw-2026-0251"]).toBe(14);
    expect(count["cw-2026-0266"]).toBe(13);
    expect(count["cw-2025-0874"]).toBe(15);
    expect(count["cw-2026-0142"]).toBe(0);
    expect(count["cw-2026-0281"]).toBe(12);
    expect(count["cw-2026-0290"]).toBe(13);
    expect(count["cw-2026-0219"]).toBe(14);
    expect(count["cw-2026-0274"]).toBe(0);
    for (const id of ["cw-2026-0297", "cw-2026-0263", "cw-2026-0305"]) expect(count[id], id).toBe(0);
    const empty = await getCase("cw-2026-0142");
    expect(empty).toMatchObject({ documents: [], assignedAttorney: "Priya Natarajan", reassignedOn: "2026-10-31" });
    expect(empty!.firm).toMatch(/fictional/);
  });

  for (const caseId of ["cw-2026-0187", "cw-2025-0911", "cw-2026-0233", "cw-2026-0198", "cw-2026-0251", "cw-2026-0266", "cw-2025-0874", "cw-2026-0281", "cw-2026-0290", "cw-2026-0219"]) {
    it(`${caseId}: every document exists, is marked fictional and extracts`, { timeout: 60_000 }, async () => {
      const { getCase, readDocumentBytes, extractPages, locateQuote } = await load();
      const c = (await getCase(caseId))!;
      const ids = c.documents.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      const pages = new Map<string, string[]>();
      for (const d of c.documents) {
        const scanned = /-(fax|scan)\.pdf$/.test(d.filename);
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
    for (const id of ["cw-2025-0911", "cw-2026-0233", "cw-2026-0198", "cw-2026-0251", "cw-2026-0266", "cw-2025-0874", "cw-2026-0281", "cw-2026-0290", "cw-2026-0219"]) {
      const c = (await getCase(id))!;
      expect(c.documents.some((d) => /TEST-NOTES/i.test(d.filename))).toBe(false);
      expect(await readFile(path.join("seed/cases", id, "TEST-NOTES.md"), "utf8")).toMatch(/agent never sees this/);
    }
  });
});
