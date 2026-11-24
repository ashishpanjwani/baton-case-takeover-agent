/**
 * File-backed storage.
 *
 *   seed/                      read-only raw source material (demo case)
 *   data/cases/<id>/uploads/   raw documents uploaded by the user
 *   data/cases/<id>/extracted/ cached text extraction (derived, rebuildable)
 *   data/cases/<id>/runs/      generated investigation runs (reports, findings)
 *   data/cases/<id>/decisions.json  approve/dismiss decisions on proposed actions
 *   data/cases/<id>/checkpoint.json finished steps of an interrupted run (resumed next time)
 *   data/cases/<id>/spend.jsonl     API usage per run, including failed runs (never shown in the UI)
 *
 * Raw source documents are never modified; generated output lives separately.
 */
import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { InvestigationRun } from "./agent/types";
import { createDurable } from "./durable";

const ROOT = process.cwd();
export const SEED_DIR = path.join(ROOT, "seed");
/**
 * Runtime state (runs, uploads, decisions). On Vercel the app folder is read-only, so
 * this defaults to the temporary folder there. That folder is not permanent: it is
 * cleared from time to time and not shared between servers.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.VERCEL
    ? path.join(os.tmpdir(), "baton-data")
    : path.join(ROOT, "data");

/** Runs, decisions and uploads: the data folder locally, a Vercel Blob store when one is connected. */
const durable = createDurable(DATA_DIR);
const caseKey = (caseId: string, ...parts: string[]) => ["cases", safeId(caseId), ...parts].join("/");

async function getJson<T>(key: string): Promise<T | null> {
  const b = await durable.get(key);
  if (!b) return null;
  try {
    return JSON.parse(b.toString("utf8")) as T;
  } catch {
    return null;
  }
}
const putJson = (key: string, value: unknown) => durable.put(key, JSON.stringify(value, null, 2), "application/json");

export interface CaseSummary {
  id: string;
  clientName: string;
  reference: string;
  caseType: string;
  stage: string;
  previousCaseManager: string;
  lastMeaningfulUpdate: string;
  lastUpdateBasis: string;
  openCmsTasks: number | null;
  assignedAttorney: string | null;
  reassignedOn: string | null;
  /** Seed documents plus uploads. A case with none can still be opened and filled by upload. */
  documentCount: number;
  /** When the most recent upload was added, or null if none. */
  latestUploadAt: string | null;
}

type CaseListEntry = Omit<CaseSummary, "documentCount" | "latestUploadAt">;

export interface CaseDocument {
  id: string;
  filename: string;
  title: string;
  category: string;
  documentDate: string | null;
  kind: "pdf" | "text";
  origin: "seed" | "upload";
  sizeBytes: number;
  addedAt: string | null;
}

export interface CaseDetail extends CaseSummary {
  firm: string;
  documents: CaseDocument[];
}

interface SeedCaseManifest {
  id: string;
  firm: string;
  assignedAttorney: string;
  reassignedOn: string;
  documents: Array<{ id: string; filename: string; title: string; category: string; documentDate: string }>;
}

type UploadRecord = Omit<CaseDocument, "kind" | "origin" | "sizeBytes"> & { storedAs: string; sizeBytes: number };

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}

const caseDataDir = (caseId: string) => path.join(DATA_DIR, "cases", safeId(caseId));

export function safeId(id: string): string {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error(`Invalid id: ${id}`);
  return id;
}

export const kindFor = (filename: string): "pdf" | "text" => (filename.toLowerCase().endsWith(".pdf") ? "pdf" : "text");

async function caseList() {
  return readJson<{ firm?: string; cases: CaseListEntry[] }>(path.join(SEED_DIR, "cases.json"), { cases: [] });
}

export async function listCases(): Promise<CaseSummary[]> {
  const { cases } = await caseList();
  return Promise.all(cases.map(async (c) => {
    const manifest = await seedManifest(c.id);
    const uploads = await listUploads(c.id);
    const documentCount = (manifest?.documents.length ?? 0) + uploads.length;
    const latestUploadAt = uploads.map((u) => u.addedAt).filter((a): a is string => !!a).sort().at(-1) ?? null;
    return { ...c, documentCount, latestUploadAt };
  }));
}

async function seedManifest(caseId: string): Promise<SeedCaseManifest | null> {
  return readJson<SeedCaseManifest | null>(path.join(SEED_DIR, "cases", safeId(caseId), "case.json"), null);
}

export async function getCase(caseId: string): Promise<CaseDetail | null> {
  const list = await caseList();
  const summary = list.cases.find((c) => c.id === caseId);
  if (!summary) return null;
  const manifest = await seedManifest(caseId);
  const documents: CaseDocument[] = [];
  if (manifest) {
    for (const d of manifest.documents) {
      const s = await stat(seedDocPath(caseId, d.filename));
      documents.push({ ...d, kind: kindFor(d.filename), origin: "seed", sizeBytes: s.size, addedAt: null });
    }
  }
  for (const u of await listUploads(caseId)) {
    documents.push({
      id: u.id, filename: u.filename, title: u.title, category: u.category, documentDate: u.documentDate,
      kind: kindFor(u.filename), origin: "upload", sizeBytes: u.sizeBytes, addedAt: u.addedAt,
    });
  }
  return {
    ...summary,
    firm: manifest?.firm ?? list.firm ?? "",
    assignedAttorney: manifest?.assignedAttorney ?? summary.assignedAttorney ?? null,
    reassignedOn: manifest?.reassignedOn ?? summary.reassignedOn ?? null,
    documentCount: documents.length,
    latestUploadAt: documents.map((d) => d.addedAt).filter((a): a is string => !!a).sort().at(-1) ?? null,
    documents,
  };
}

const seedDocPath = (caseId: string, filename: string) =>
  path.join(SEED_DIR, "cases", safeId(caseId), "documents", path.basename(filename));

/** One record per upload, plus the single list file older versions wrote. */
async function listUploads(caseId: string): Promise<UploadRecord[]> {
  const legacy = (await getJson<UploadRecord[]>(caseKey(caseId, "uploads.json"))) ?? [];
  const keys = (await durable.list(caseKey(caseId, "uploads-meta") + "/")).filter((k) => k.endsWith(".json"));
  const recs = (await Promise.all(keys.map((k) => getJson<UploadRecord>(k)))).filter((r): r is UploadRecord => !!r);
  const seen = new Set(legacy.map((u) => u.id));
  return [...legacy, ...recs.filter((r) => !seen.has(r.id))].sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? ""));
}

export async function readDocumentBytes(caseId: string, doc: CaseDocument): Promise<Buffer> {
  if (doc.origin === "seed") return readFile(seedDocPath(caseId, doc.filename));
  const rec = (await listUploads(caseId)).find((u) => u.id === doc.id);
  if (!rec) throw new Error(`Upload ${doc.id} not found`);
  const bytes = await durable.get(caseKey(caseId, "uploads", path.basename(rec.storedAs)));
  if (!bytes) throw new Error(`Upload ${doc.id} file is missing`);
  return bytes;
}

export async function addUpload(
  caseId: string,
  file: { filename: string; bytes: Buffer; title?: string; category?: string },
): Promise<CaseDocument> {
  const id = `up-${randomUUID().slice(0, 8)}`;
  const base = path.basename(file.filename).replace(/[^\w.\- ]+/g, "_");
  const storedAs = `${id}__${base}`;
  await durable.put(caseKey(caseId, "uploads", storedAs), file.bytes);
  const rec: UploadRecord = {
    id, filename: base, storedAs, title: file.title?.trim() || base.replace(/\.[^.]+$/, ""),
    category: file.category?.trim() || "Uploaded", documentDate: null, sizeBytes: file.bytes.length,
    addedAt: new Date().toISOString(),
  };
  await putJson(caseKey(caseId, "uploads-meta", `${id}.json`), rec);
  return { ...rec, kind: kindFor(base), origin: "upload" };
}

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export interface OcrPage { page: number; confidence: number }
export interface ExtractionCache { version?: number; hash: string; pages: string[]; ocrPages?: OcrPage[]; emptyPages?: number[] }

export async function readExtractionCache(caseId: string, docId: string) {
  return readJson<ExtractionCache | null>(path.join(caseDataDir(caseId), "extracted", `${safeId(docId)}.json`), null);
}
export async function writeExtractionCache(caseId: string, docId: string, value: ExtractionCache) {
  await writeJson(path.join(caseDataDir(caseId), "extracted", `${safeId(docId)}.json`), value);
}

export async function saveRun(run: InvestigationRun) {
  await putJson(caseKey(run.caseId, "runs", `${safeId(run.id)}.json`), run);
}

export async function getRun(caseId: string, runId: string): Promise<InvestigationRun | null> {
  return getJson<InvestigationRun>(caseKey(caseId, "runs", `${safeId(runId)}.json`));
}

const runKeys = async (caseId: string) => (await durable.list(caseKey(caseId, "runs") + "/")).filter((k) => k.endsWith(".json"));
/** Run ids start with their start time ("run-<ms>-..."), so the newest can be found without reading every run. */
const runTime = (key: string) => Number(/run-(\d+)-/.exec(key)?.[1] ?? 0);

export async function latestRun(caseId: string): Promise<InvestigationRun | null> {
  const keys = (await runKeys(caseId)).sort((a, b) => runTime(b) - runTime(a));
  for (const k of keys) {
    const r = await getJson<InvestigationRun>(k);
    if (r) return r;
  }
  return null;
}

export async function listRuns(caseId: string): Promise<InvestigationRun[]> {
  const runs = await Promise.all((await runKeys(caseId)).map((k) => getJson<InvestigationRun>(k)));
  return runs.filter((r): r is InvestigationRun => !!r).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

/** Finished steps of an interrupted run, so a re-run does not pay for them again. */
const checkpointFile = (caseId: string) => path.join(caseDataDir(caseId), "checkpoint.json");
export async function readCheckpoint<T>(caseId: string): Promise<T | null> {
  try {
    return await readJson<T | null>(checkpointFile(caseId), null);
  } catch {
    return null; // unreadable checkpoint: start fresh rather than fail the run
  }
}
export async function writeCheckpoint(caseId: string, value: unknown) {
  // Write then rename, so a reader never sees a half-written file.
  const file = checkpointFile(caseId);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeJson(tmp, value);
  await rename(tmp, file);
}
export async function clearCheckpoint(caseId: string) {
  await rm(checkpointFile(caseId), { force: true });
}

/** Append-only record of API usage per run (completed or failed). Read by `npm run spend`. */
export async function appendSpend(caseId: string, entry: unknown) {
  await mkdir(caseDataDir(caseId), { recursive: true });
  await appendFile(path.join(caseDataDir(caseId), "spend.jsonl"), JSON.stringify(entry) + "\n");
}

export interface ActionDecision {
  status: "approved" | "dismissed";
  note: string | null;
  editedDraftBody: string | null;
  decidedAt: string;
}
export type DecisionMap = Record<string, ActionDecision>; // key: actionId

/** One record per decision (so quick successive clicks can't overwrite each other), plus the older single file. */
export async function getDecisions(caseId: string, runId: string): Promise<DecisionMap> {
  const legacy = (await getJson<Record<string, DecisionMap>>(caseKey(caseId, "decisions.json")))?.[runId] ?? {};
  const prefix = caseKey(caseId, "decisions", safeId(runId)) + "/";
  const keys = (await durable.list(prefix)).filter((k) => k.endsWith(".json"));
  const out: DecisionMap = { ...legacy };
  for (const k of keys) {
    const d = await getJson<ActionDecision | { cleared: true }>(k);
    const actionId = k.slice(prefix.length, -".json".length);
    if (!d) continue;
    if ("cleared" in d) delete out[actionId];
    else out[actionId] = d;
  }
  return out;
}

export async function setDecision(caseId: string, runId: string, actionId: string, decision: ActionDecision | null) {
  const key = caseKey(caseId, "decisions", safeId(runId), `${safeId(actionId)}.json`);
  // An undo is recorded rather than deleted, so it also overrides a decision in the older single file.
  await putJson(key, decision ?? { cleared: true });
}
