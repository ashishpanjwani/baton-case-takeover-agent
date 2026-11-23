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
  }).catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
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
  const worker = await getWorker();
  const { data } = await worker.recognize(Buffer.from(png));
  return { text: tidy(data.text), confidence: Math.round(data.confidence) };
}

/** Tesseract output: drop trailing spaces and runs of blank lines. */
function tidy(t: string) {
  return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
