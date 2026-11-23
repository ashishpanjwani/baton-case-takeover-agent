/**
 * Text extraction for supported document formats.
 * PDFs are extracted page by page so citations can point at a page.
 * Pages with no usable text layer (scans, faxes) are OCR'd locally; see ocr.ts.
 */
import { extractText, getDocumentProxy } from "unpdf";
import { needsOcr, ocrEnabled, ocrPdfPage } from "./ocr";
import {
  type CaseDocument, type OcrPage, readDocumentBytes, readExtractionCache, sha256, writeExtractionCache,
} from "./store";

export const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".csv", ".eml"];

/** Bump when extraction output changes, so cached results are redone. */
const EXTRACTION_VERSION = 2;

export function isSupported(filename: string) {
  const f = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => f.endsWith(ext));
}

export interface ExtractedDocument {
  docId: string;
  hash: string;
  pages: string[];
  /** Pages whose text came from OCR rather than the PDF's text layer. */
  ocrPages: OcrPage[];
  /** Pages that still have no usable text (OCR off, failed, or found nothing). */
  emptyPages: number[];
  charCount: number;
  cached: boolean;
}

export interface PageExtraction {
  pages: string[];
  ocrPages: OcrPage[];
  emptyPages: number[];
}

export async function extractPages(
  bytes: Buffer, kind: "pdf" | "text", opts: { ocr?: boolean } = {},
): Promise<PageExtraction> {
  if (kind === "text") return { pages: [bytes.toString("utf8").replace(/\r\n/g, "\n")], ocrPages: [], emptyPages: [] };
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((t) => t.trim());
  const ocrPages: OcrPage[] = [];
  const useOcr = opts.ocr ?? ocrEnabled();
  for (let i = 0; i < pages.length; i++) {
    if (!useOcr || !needsOcr(pages[i])) continue;
    try {
      const r = await ocrPdfPage(pdf, i + 1);
      if (r.text.length > pages[i].length) {
        pages[i] = r.text;
        ocrPages.push({ page: i + 1, confidence: r.confidence });
      }
    } catch (e) {
      console.error(`OCR failed on page ${i + 1}:`, e);
    }
  }
  const emptyPages = pages.flatMap((p, i) => (needsOcr(p) ? [i + 1] : []));
  return { pages, ocrPages, emptyPages };
}

export async function extractDocument(caseId: string, doc: CaseDocument): Promise<ExtractedDocument> {
  const bytes = await readDocumentBytes(caseId, doc);
  const hash = sha256(bytes);
  const cached = await readExtractionCache(caseId, doc.id);
  if (cached && cached.hash === hash && cached.version === EXTRACTION_VERSION) {
    return {
      docId: doc.id, hash, pages: cached.pages, ocrPages: cached.ocrPages ?? [], emptyPages: cached.emptyPages ?? [],
      charCount: cached.pages.join("").length, cached: true,
    };
  }
  const x = await extractPages(bytes, doc.kind);
  await writeExtractionCache(caseId, doc.id, { version: EXTRACTION_VERSION, hash, ...x });
  return { docId: doc.id, hash, ...x, charCount: x.pages.join("").length, cached: false };
}
