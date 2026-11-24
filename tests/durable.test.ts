/**
 * Storage that survives between requests. The Blob backend is exercised against an
 * in-memory stand-in for @vercel/blob, so no Blob store or network is needed.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const blobs = new Map<string, Buffer>();
const calls = { list: 0, put: [] as { key: string; access: string }[] };
vi.mock("@vercel/blob", () => ({
  put: async (key: string, body: Buffer | string, opts: { access: string }) => {
    calls.put.push({ key, access: opts.access });
    blobs.set(key, Buffer.from(body));
    return { pathname: key };
  },
  get: async (key: string) => {
    const b = blobs.get(key);
    return b ? { statusCode: 200, stream: new Response(new Uint8Array(b)).body } : null;
  },
  list: async ({ prefix }: { prefix: string }) => {
    calls.list++;
    return { blobs: [...blobs.keys()].filter((k) => k.startsWith(prefix)).map((pathname) => ({ pathname })), hasMore: false };
  },
  del: async (keys: string[]) => { for (const k of keys) blobs.delete(k); },
}));

let tmp: string;
beforeAll(() => { tmp = mkdtempSync(path.join(os.tmpdir(), "cta-durable-")); process.env.DATA_DIR = tmp; });
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
afterEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.VERCEL; blobs.clear(); calls.list = 0; calls.put = []; });

const load = async () => {
  vi.resetModules();
  return { ...(await import("@/lib/store")), ...(await import("@/lib/durable")) };
};

const fakeRun = (caseId: string, id: string, completedAt: string) =>
  ({ id, caseId, completedAt, mode: "ai", report: { findings: [] } }) as never;

for (const backend of ["files", "blob"] as const) {
  describe(`durable storage (${backend})`, () => {
    it("keeps runs, decisions and uploads, and finds the latest run", async () => {
      if (backend === "blob") process.env.BLOB_READ_WRITE_TOKEN = "test";
      const { saveRun, latestRun, listRuns, getRun, setDecision, getDecisions, addUpload, getCase, readDocumentBytes } = await load();
      const id = backend === "blob" ? "cw-2026-0142" : "cw-2026-0274";
      await saveRun(fakeRun(id, "run-1000-aaaaaa", "2026-11-01T00:00:00Z"));
      await saveRun(fakeRun(id, "run-2000-bbbbbb", "2026-11-02T00:00:00Z"));
      expect((await latestRun(id))!.id).toBe("run-2000-bbbbbb");
      expect((await listRuns(id)).map((r) => r.id)).toEqual(["run-2000-bbbbbb", "run-1000-aaaaaa"]);
      expect((await getRun(id, "run-1000-aaaaaa"))!.id).toBe("run-1000-aaaaaa");

      const d = { status: "approved" as const, note: null, editedDraftBody: null, decidedAt: "2026-11-02T01:00:00Z" };
      await setDecision(id, "run-2000-bbbbbb", "A1", d);
      await setDecision(id, "run-2000-bbbbbb", "A2", { ...d, status: "dismissed" });
      await setDecision(id, "run-2000-bbbbbb", "A2", null); // undo
      expect(await getDecisions(id, "run-2000-bbbbbb")).toEqual({ A1: d });

      const up = await addUpload(id, { filename: "late note.txt", bytes: Buffer.from("[FICTIONAL] Client called.") });
      const c = (await getCase(id))!;
      expect(c.documents.map((x) => x.id)).toContain(up.id);
      expect((await readDocumentBytes(id, c.documents.find((x) => x.id === up.id)!)).toString()).toMatch(/Client called/);
      expect(c.latestUploadAt).not.toBeNull();

      if (backend === "blob") {
        // Nothing went to the local disk, and every blob is private.
        expect(calls.put.length).toBeGreaterThan(0);
        expect(calls.put.every((p) => p.access === "private")).toBe(true);
      }
    });

    it("lists the case list's data with one listing, not one per case", async () => {
      if (backend !== "blob") return;
      process.env.BLOB_READ_WRITE_TOKEN = "test";
      const { listCases, latestRun } = await load();
      const cases = await listCases();
      await Promise.all(cases.map((c) => latestRun(c.id)));
      expect(cases.length).toBeGreaterThan(10);
      expect(calls.list).toBe(1);
    });
  });
}

describe("storage warning", () => {
  it("is persistent locally, and on Vercel only with a Blob store", async () => {
    const { storageIsPersistent } = await load();
    const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
    expect(storageIsPersistent(env({}))).toBe(true);
    expect(storageIsPersistent(env({ VERCEL: "1" }))).toBe(false);
    expect(storageIsPersistent(env({ VERCEL: "1", BLOB_READ_WRITE_TOKEN: "x" }))).toBe(true);
    expect(storageIsPersistent(env({ VERCEL: "1", BLOB_STORE_ID: "store_x", VERCEL_OIDC_TOKEN: "t" }))).toBe(true);
    expect(storageIsPersistent(env({ VERCEL: "1", BLOB_STORE_ID: "store_x" }))).toBe(false);
  });
});
