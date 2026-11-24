/**
 * Local OCR for scanned PDF pages: pages are rendered to an image (pdf.js +
 * @napi-rs/canvas, via unpdf) and read with Tesseract. Runs entirely on this
 * machine with bundled English language data. No document leaves the server
 * and no AI model is involved, so it works the same in demo and AI mode.
 */
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { renderPageAsImage, type getDocumentProxy } from "unpdf";

type PDFDocumentProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

/** A PDF page with fewer visible characters than this is treated as scanned. */
export const OCR_MIN_CHARS = 25;
/** Render scale: 3 ≈ 216 dpi, a good size for Tesseract. */
const RENDER_SCALE = 3;
/**
 * Longest one page may take, including starting the OCR engine. If the engine can't
 * start (e.g. files missing on a host), Tesseract waits forever; this turns that into
 * an error, so the page is reported as unreadable and the investigation carries on.
 */
export const OCR_TIMEOUT_MS = 90_000;

export function ocrEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.OCR_ENABLED !== "false";
}

export function needsOcr(pageText: string) {
  return pageText.replace(/\s/g, "").length < OCR_MIN_CHARS;
}

let workerPromise: Promise<Worker> | null = null;

function getWorker() {
  workerPromise ??= createWorker("eng", 1, {
    langPath: path.join(process.cwd(), "node_modules/@tesseract.js-data/eng/4.0.0_best_int"),
    gzip: true,
    cacheMethod: "none",
    errorHandler: (e: unknown) => console.error("OCR worker error:", e),
  }).catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

/** Drop the worker after a failure, so the next page starts a fresh one. */
async function resetWorker() {
  const w = workerPromise;
  workerPromise = null;
  try {
    await (await Promise.race([w, new Promise<null>((r) => setTimeout(() => r(null), 1000))]))?.terminate();
  } catch {
    // already gone
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

export interface OcrResult {
  text: string;
  /** Tesseract's mean word confidence, 0–100. */
  confidence: number;
}

export async function ocrPdfPage(pdf: PDFDocumentProxy, pageNumber: number): Promise<OcrResult> {
  const png = await renderPageAsImage(pdf, pageNumber, {
    scale: RENDER_SCALE,
    canvasImport: () => import("@napi-rs/canvas"),
  });
  try {
    return await withTimeout((async () => {
      const worker = await getWorker();
      const { data } = await worker.recognize(Buffer.from(png));
      return { text: tidy(data.text), confidence: Math.round(data.confidence) };
    })(), OCR_TIMEOUT_MS, "OCR");
  } catch (e) {
    await resetWorker();
    throw e;
  }
}

/** Tesseract output: drop trailing spaces and runs of blank lines. */
function tidy(t: string) {
  return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
