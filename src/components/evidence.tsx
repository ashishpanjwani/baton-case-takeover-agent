"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { locateQuote } from "@/lib/citations";
import type { Evidence } from "@/lib/schemas";
import { Badge, cx } from "./ui";

export interface DocMeta {
  id: string;
  title: string;
  category: string;
  kind: "pdf" | "text";
  origin: "seed" | "upload";
  documentDate: string | null;
}

interface Target {
  docId: string;
  quote?: string;
  note?: string | null;
}

const Ctx = createContext<{ open: (t: Target) => void; docs: Map<string, DocMeta> } | null>(null);

export function useEvidence() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEvidence outside EvidenceProvider");
  return c;
}

export function EvidenceProvider({ caseId, documents, children }: { caseId: string; documents: DocMeta[]; children: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const docs = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);
  const open = useCallback((t: Target) => setTarget(t), []);
  return (
    <Ctx.Provider value={{ open, docs }}>
      {children}
      <DocumentDrawer caseId={caseId} target={target} meta={target ? docs.get(target.docId) : undefined} onClose={() => setTarget(null)} />
    </Ctx.Provider>
  );
}

/** A clickable citation: source reference plus the quoted excerpt. */
export function EvidenceItem({ e, compact = false }: { e: Evidence; compact?: boolean }) {
  const { open, docs } = useEvidence();
  const d = docs.get(e.docId);
  const label = (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
      <DocIcon kind={d?.kind ?? "text"} />
      <span className="underline decoration-accent/30 underline-offset-2 group-hover:decoration-accent">{d?.title ?? e.docId}</span>
      {e.page !== null && <span className="text-ink-3">· p.{e.page}</span>}
    </span>
  );
  if (compact) {
    return (
      <button type="button" onClick={() => open({ docId: e.docId, quote: e.quote, note: e.note })} className="group text-left" title={`“${e.quote}”`}>
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => open({ docId: e.docId, quote: e.quote, note: e.note })}
      className="group block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-left transition hover:border-accent/50 hover:bg-accent-soft/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label}
        {e.note && <span className="text-[11.5px] text-ink-3">{e.note}</span>}
      </div>
      <div className="mt-1 text-[13px] leading-snug text-ink-2">“{e.quote}”</div>
    </button>
  );
}

export function EvidenceList({ evidence, compact }: { evidence: Evidence[]; compact?: boolean }) {
  if (evidence.length === 0) return null;
  if (compact)
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {evidence.map((e, i) => <EvidenceItem key={i} e={e} compact />)}
      </div>
    );
  return (
    <div className="space-y-1.5">
      {evidence.map((e, i) => <EvidenceItem key={i} e={e} />)}
    </div>
  );
}

export function DocIcon({ kind }: { kind: "pdf" | "text" }) {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden className="shrink-0">
      <path d="M1.5 1.5h6l3 3v8h-9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      {kind === "pdf" ? <path d="M3.5 8h5M3.5 10h3.5" stroke="currentColor" strokeWidth="1.1" /> : <path d="M3.5 7h5M3.5 9h5M3.5 11h3" stroke="currentColor" strokeWidth="1.1" />}
    </svg>
  );
}

type DocText = { pages: string[]; ocrPages?: { page: number; confidence: number }[]; emptyPages?: number[] };
const cache = new Map<string, Promise<DocText>>();
function fetchDoc(caseId: string, docId: string) {
  const key = `${caseId}/${docId}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`/api/cases/${caseId}/documents/${docId}`).then(async (r) => {
        if (!r.ok) {
          cache.delete(key);
          throw new Error("Could not load document");
        }
        return r.json();
      }),
    );
  }
  return cache.get(key)!;
}

function DocumentDrawer({ caseId, target, meta, onClose }: { caseId: string; target: Target | null; meta?: DocMeta; onClose: () => void }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [ocr, setOcr] = useState<Map<number, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const markRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!target) return;
    setPages(null);
    setOcr(new Map());
    setError(null);
    fetchDoc(caseId, target.docId).then(
      (d) => {
        setPages(d.pages);
        setOcr(new Map((d.ocrPages ?? []).map((p) => [p.page, p.confidence])));
      },
      (e) => setError(String(e.message ?? e)),
    );
  }, [caseId, target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  const match = useMemo(() => (pages && target?.quote ? locateQuote(target.quote, pages) : null), [pages, target]);

  useEffect(() => {
    if (pages) {
      if (markRef.current) markRef.current.scrollIntoView({ block: "center" });
      else bodyRef.current?.scrollTo({ top: 0 });
    }
  }, [pages, match]);

  if (!target) return null;
  const isPdf = meta?.kind === "pdf";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Source document">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[680px] flex-col border-l border-line bg-surface shadow-2xl">
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] uppercase tracking-wide text-ink-3">{meta?.category ?? "Source document"} · {target.docId}</div>
              <div className="mt-0.5 text-[16px] font-semibold">{meta?.title ?? target.docId}</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/cases/${caseId}/documents/${target.docId}/file${isPdf && match ? `#page=${match.page}` : ""}`}
                target="_blank" rel="noreferrer"
                className="rounded-md border border-line-strong px-2.5 py-1 text-[12.5px] font-medium hover:border-accent hover:text-accent"
              >
                Open original{isPdf ? " PDF" : ""}
              </a>
              <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[18px] leading-none text-ink-3 hover:bg-sunken" aria-label="Close">×</button>
            </div>
          </div>
          {target.quote && (
            <div className={cx("mt-3 rounded-md border px-3 py-2 text-[13px]", match ? "border-line bg-canvas" : "border-red/30 bg-red-soft")}>
              <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">
                {match ? `Cited excerpt${isPdf ? ` — page ${match.page}` : ""}` : pages ? "Excerpt not found in this document" : "Cited excerpt"}
              </div>
              <div className="mt-0.5 text-ink-2">“{target.quote}”</div>
              {target.note && <div className="mt-1 text-[12px] text-ink-3">{target.note}</div>}
            </div>
          )}
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto bg-sunken/50 px-5 py-5">
          {error && <div className="text-[13px] text-red">{error}</div>}
          {!pages && !error && <div className="text-[13px] text-ink-3">Loading document…</div>}
          {pages?.map((text, i) => (
            <div key={i} className="mb-4">
              {isPdf && (
                <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-wide text-ink-3">
                  Page {i + 1} of {pages.length}
                  {ocr.has(i + 1) && <Badge tone="amber" className="normal-case tracking-normal">Scanned · text read by OCR ({ocr.get(i + 1)}% confidence)</Badge>}
                  {!text.trim() && <Badge tone="neutral" className="normal-case tracking-normal">No text could be extracted</Badge>}
                </div>
              )}
              <pre className={cx("whitespace-pre-wrap break-words rounded-md border bg-surface px-4 py-3.5 font-mono text-[12.5px] leading-[1.6] text-ink", match?.page === i + 1 ? "border-accent/40" : "border-line")}>
                {renderHighlighted(text, match && match.page === i + 1 ? match.ranges : [], markRef)}
              </pre>
            </div>
          ))}
          {pages && (
            <p className="text-[11.5px] text-ink-3">
              Text shown is extracted from the original file{ocr.size ? "; scanned pages were read by OCR and may contain recognition errors" : ""}. Open the original to see the source as filed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function renderHighlighted(text: string, ranges: Array<{ start: number; end: number }>, markRef: React.RefObject<HTMLElement | null>) {
  if (ranges.length === 0) return text;
  const out: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach((r, i) => {
    if (r.start > pos) out.push(text.slice(pos, r.start));
    out.push(
      <mark key={i} className="cite" ref={i === 0 ? (el) => { markRef.current = el; } : undefined}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  });
  out.push(text.slice(pos));
  return out;
}
