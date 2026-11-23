/**
 * OCR of scanned PDFs (local Tesseract, no network, no API key).
 * Fixture: seed/samples/scanned-pt-intake-fax.pdf, an image-only PDF (npm run seed:scanned).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locateQuote } from "@/lib/citations";
import { extractPages } from "@/lib/extract";
import { renderDocument } from "@/lib/agent/prompts";

const SCANNED = "seed/samples/scanned-pt-intake-fax.pdf";

describe("OCR for scanned PDFs", () => {
  it("has no text layer without OCR", async () => {
    const r = await extractPages(await readFile(SCANNED), "pdf", { ocr: false });
    expect(r.pages.every((p) => p === "")).toBe(true);
    expect(r.emptyPages).toEqual([1, 2]);
    expect(r.ocrPages).toEqual([]);
  });

  it("reads every scanned page with OCR, and quotes from it verify", async () => {
    const r = await extractPages(await readFile(SCANNED), "pdf", { ocr: true });
    expect(r.ocrPages.map((p) => p.page)).toEqual([1, 2]);
    expect(r.emptyPages).toEqual([]);
    for (const p of r.ocrPages) expect(p.confidence).toBeGreaterThan(80);
    expect(locateQuote("Date of evaluation: 08/19/2026", r.pages)?.page).toBe(1);
    expect(locateQuote("09/16/2026 Visit 4 - no-show, rescheduled", r.pages)?.page).toBe(2);
    const prompt = renderDocument({ id: "up-1", title: "PT fax", category: "Medical", kind: "pdf", pages: r.pages, ocrPages: [1, 2] });
    expect(prompt).toContain("[Page 1 — text from OCR of a scanned image; may contain recognition errors]");
  }, 60_000);

  it("leaves born-digital seed PDFs alone", async () => {
    const dir = "seed/cases/cw-2026-0187/documents";
    for (const f of (await readdir(dir)).filter((f) => f.endsWith(".pdf"))) {
      const r = await extractPages(await readFile(path.join(dir, f)), "pdf", { ocr: true });
      expect(r.ocrPages, f).toEqual([]);
      expect(r.emptyPages, f).toEqual([]);
    }
  });
});
