import { describe, expect, it } from "vitest";
import { locateQuote } from "@/lib/citations";

describe("locateQuote", () => {
  const pages = ["Page one text.\nThe office note for date of service 04/29/2026 had not been finalized by the treating provider at the time of\nprocessing.", "Second page — Lakeside Radiology Group bills separately."];

  it("matches across line wraps and normalises whitespace/case", () => {
    const m = locateQuote("the office note for date of service 04/29/2026 had not been finalized by the treating provider at the time of processing.", pages);
    expect(m?.page).toBe(1);
  });

  it("finds the correct page", () => {
    expect(locateQuote("Lakeside Radiology Group bills separately", pages)?.page).toBe(2);
  });

  it("normalises dashes and curly quotes", () => {
    expect(locateQuote("Second page - Lakeside Radiology", pages)?.page).toBe(2);
  });

  it("supports ellipsis-joined fragments in order", () => {
    expect(locateQuote("The office note for date ... the treating provider", pages)).not.toBeNull();
    expect(locateQuote("the treating provider ... The office note for date", pages)).toBeNull();
  });

  it("rejects fabricated or altered quotes", () => {
    expect(locateQuote("The office note for 04/29/2026 was received", pages)).toBeNull();
    expect(locateQuote("Lakeside Radiology Group bills jointly", pages)).toBeNull();
  });

  it("rejects trivially short quotes", () => {
    expect(locateQuote("page", pages)).toBeNull();
  });

  it("returns highlight ranges into the raw text", () => {
    const m = locateQuote("Lakeside Radiology Group", pages)!;
    expect(pages[1].slice(m.ranges[0].start, m.ranges[0].end)).toBe("Lakeside Radiology Group");
  });
});
