/**
 * Storage for what must survive between requests: investigation runs, approval
 * decisions and uploaded documents.
 *
 * Locally this is the data folder on disk. On a serverless host (Vercel), every
 * request may run on a different short-lived server with its own temporary disk,
 * so a run saved by one request is invisible to the next. There, connect a Vercel
 * Blob store (it sets BLOB_READ_WRITE_TOKEN) and everything is kept in private
 * blobs that every server can read. A store id with the deployment's OIDC token also works.
 *
 * Keys are paths such as "cases/cw-2026-0187/runs/run-123.json".
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Durable {
  readonly kind: "files" | "blob";
  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer | string, contentType?: string): Promise<void>;
  /** Every key under a prefix, e.g. "cases/". */
  list(prefix: string): Promise<string[]>;
  del(keys: string[]): Promise<void>;
}

function filesStore(root: string): Durable {
  const abs = (key: string) => path.join(root, ...key.split("/"));
  return {
    kind: "files",
    async get(key) {
      try {
        return await readFile(abs(key));
      } catch {
        return null;
      }
    },
    async put(key, body) {
      await mkdir(path.dirname(abs(key)), { recursive: true });
      await writeFile(abs(key), body);
    },
    async list(prefix) {
      const dir = abs(prefix.replace(/\/$/, ""));
      try {
        const entries = await readdir(dir, { recursive: true, withFileTypes: true });
        return entries
          .filter((e) => e.isFile())
          .map((e) => path.relative(root, path.join(e.parentPath, e.name)).split(path.sep).join("/"));
      } catch {
        return [];
      }
    },
    async del(keys) {
      await Promise.all(keys.map((k) => rm(abs(k), { force: true })));
    },
  };
}

function blobStore(): Durable {
  // Loaded only when a Blob store is configured.
  const sdk = import("@vercel/blob");
  return {
    kind: "blob",
    async get(key) {
      const { get } = await sdk;
      // useCache: false reads the latest content, not a cached copy of an earlier version.
      const r = await get(key, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    },
    async put(key, body, contentType) {
      const { put } = await sdk;
      await put(key, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });
    },
    async list(prefix) {
      const { list } = await sdk;
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, cursor, limit: 1000 });
        keys.push(...page.blobs.map((b) => b.pathname));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
    async del(keys) {
      if (!keys.length) return;
      const { del } = await sdk;
      await del(keys);
    },
  };
}

/**
 * A Blob store is connected: either with a read-write token, or (newer Vercel connections)
 * with a store id that the SDK signs in to using the deployment's Vercel OIDC token.
 */
export function blobConfigured(env: NodeJS.ProcessEnv = process.env) {
  return !!env.BLOB_READ_WRITE_TOKEN || (!!env.BLOB_STORE_ID && !!env.VERCEL_OIDC_TOKEN);
}

/** True when saved runs persist across requests: always locally, and on Vercel only with a Blob store. */
export function storageIsPersistent(env: NodeJS.ProcessEnv = process.env) {
  return !env.VERCEL || blobConfigured(env);
}

/**
 * A short-lived memo of key listings, so one page render (which looks at every case)
 * costs one listing instead of one per case. Any write clears it.
 */
export function withListingMemo(store: Durable, ttlMs = 2000): Durable {
  let memo: { prefix: string; at: number; keys: Promise<string[]> } | null = null;
  const clear = () => { memo = null; };
  return {
    kind: store.kind,
    get: (k) => store.get(k),
    async put(k, b, t) { clear(); await store.put(k, b, t); clear(); },
    async del(k) { clear(); await store.del(k); clear(); },
    async list(prefix) {
      if (!memo || Date.now() - memo.at > ttlMs || !prefix.startsWith(memo.prefix)) {
        // List from "cases/" once and filter, rather than listing each case separately.
        const root = prefix.startsWith("cases/") ? "cases/" : prefix;
        memo = { prefix: root, at: Date.now(), keys: store.list(root) };
      }
      const keys = await memo.keys.catch((e) => { clear(); throw e; });
      return keys.filter((k) => k.startsWith(prefix));
    },
  };
}

export function createDurable(dataDir: string, env: NodeJS.ProcessEnv = process.env): Durable {
  return withListingMemo(blobConfigured(env) ? blobStore() : filesStore(dataDir));
}
