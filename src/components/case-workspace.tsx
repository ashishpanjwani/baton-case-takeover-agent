"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InvestigationEvent } from "@/lib/agent/types";
import type { CaseDocument } from "@/lib/store";
import { DocIcon, EvidenceProvider, useEvidence } from "./evidence";
import { Badge, cx, formatDate, formatDateTime } from "./ui";

/** AI mode carries only what the user needs: how long a run usually takes. */
type Mode = { kind: "ai"; typicalMs: number } | { kind: "demo"; /** A prepared example exists for this case. */ available: boolean };

export function CaseWorkspace(props: {
  caseId: string;
  documents: CaseDocument[];
  mode: Mode;
  lastRun: { id: string; completedAt: string; mode: "ai" | "demo"; findings: number } | null;
}) {
  return (
    <EvidenceProvider caseId={props.caseId} documents={props.documents}>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <DocumentsPanel caseId={props.caseId} documents={props.documents} />
        <InvestigatePanel {...props} />
      </div>
    </EvidenceProvider>
  );
}

function DocumentsPanel({ caseId, documents }: { caseId: string; documents: CaseDocument[] }) {
  const { open } = useEvidence();
  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold">Case file</h2>
          <p className="text-[12.5px] text-ink-3">{documents.length ? `${documents.length} documents in the reassignment review package` : "No documents yet"}</p>
        </div>
        <UploadButton caseId={caseId} />
      </div>
      {documents.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-ink">This case has no documents yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-2">
            Upload the case export from the CMS: intake notes, records, bills, correspondence, CMS notes and task history. PDF and text files are supported, and scanned PDFs are read with OCR. You can select several files at once.
          </p>
        </div>
      )}
      <div className="border-b border-line bg-canvas px-4 py-2 text-[12px] text-ink-3">
        Documents are added by hand in this prototype. With a CMS connection, the case file is gathered automatically when a case is reassigned. <Link href="/connections#cms" className="text-accent">How that works</Link>
      </div>
      <ul className="divide-y divide-line">
        {documents.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => open({ docId: d.id })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas">
              <span className="text-ink-3"><DocIcon kind={d.kind} /></span>
              <span className="w-12 shrink-0 font-mono text-[11.5px] text-ink-3">{d.id}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{d.title}</span>
              {d.origin === "upload" && <Badge tone="accent">Uploaded</Badge>}
              <span className="hidden w-36 shrink-0 truncate text-[12.5px] text-ink-3 sm:block">{d.category}</span>
              <span className="w-24 shrink-0 text-right text-[12.5px] text-ink-3 tabular">{d.documentDate ? formatDate(d.documentDate) : d.addedAt ? formatDate(d.addedAt.slice(0, 10)) : "—"}</span>
              <span className="w-10 shrink-0 text-right text-[11.5px] uppercase text-ink-3">{d.kind === "pdf" ? "PDF" : "TXT"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UploadButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; msg: string | null; error: boolean }>({ busy: false, msg: null, error: false });

  async function uploadOne(f: File): Promise<{ msg: string; error: boolean }> {
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) return { msg: `${f.name}: ${j.error ?? "upload failed"}`, error: true };
    if (j.warning) return { msg: `${f.name}: ${j.warning}`, error: true };
    if (j.chars === 0) return { msg: `Added "${j.document.title}", but no text could be extracted, even with OCR. It will not be analysed.`, error: true };
    return {
      msg: `Added "${j.document.title}"${j.ocrPages ? ` (${j.ocrPages} scanned page${j.ocrPages > 1 ? "s" : ""} read by OCR)` : ""}`,
      error: false,
    };
  }

  async function onFiles(files: File[]) {
    const problems: string[] = [];
    let added = 0;
    let last = "";
    for (const [i, f] of files.entries()) {
      setState({ busy: true, msg: files.length > 1 ? `Uploading ${i + 1} of ${files.length}: ${f.name}…` : `Uploading ${f.name}…`, error: false });
      const r = await uploadOne(f);
      if (r.error) problems.push(r.msg);
      else added++;
      last = r.msg;
    }
    if (input.current) input.current.value = "";
    setState({
      busy: false,
      msg: files.length === 1 ? last : `Added ${added} of ${files.length} files.${problems.length ? ` ${problems.join(" ")}` : ""}`,
      error: problems.length > 0,
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end">
      <input ref={input} type="file" multiple accept=".pdf,.txt,.md,.csv,.eml" className="hidden" onChange={(e) => e.target.files?.length && onFiles([...e.target.files])} />
      <button type="button" disabled={state.busy} onClick={() => input.current?.click()} className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] font-medium hover:border-accent hover:text-accent disabled:opacity-50">
        + Add documents
      </button>
      {state.msg && <span className={cx("mt-1 max-w-[260px] text-right text-[11.5px]", state.error ? "text-red" : "text-ink-3")}>{state.msg}</span>}
    </div>
  );
}

/* ---------------- Investigation ---------------- */

interface DocProgress { title: string; extract?: { status: string; detail?: string }; analyze?: { status: string; detail?: string } }

type TimedStep = "analyze" | "synthesize" | "plan";
const TIMED_STEPS: TimedStep[] = ["analyze", "synthesize", "plan"];

function InvestigatePanel({ caseId, documents, mode, lastRun }: Parameters<typeof CaseWorkspace>[0]) {
  const router = useRouter();
  const [events, setEvents] = useState<InvestigationEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [lostConnection, setLostConnection] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick once a second while running, so time remaining counts down.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  async function start() {
    setEvents([]);
    setLostConnection(false);
    setRunning(true);
    let finished = false;
    try {
      const res = await fetch(`/api/cases/${caseId}/investigate`, { method: "POST" });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const e = JSON.parse(l) as InvestigationEvent;
          if (e.type === "completed" || e.type === "failed") finished = true;
          setEvents((ev) => [...ev, e]);
        }
      }
      if (!finished) setLostConnection(true);
    } catch {
      // The connection to the progress updates dropped. The server keeps working and saves the report.
      if (!finished) setLostConnection(true);
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const view = useMemo(() => summarise(events), [events]);
  const started = events.length > 0;
  const eta = (step: TimedStep) => stepTime(view, step, nowMs);
  const totalLeft = view.estimates && running ? TIMED_STEPS.reduce((n, s) => n + (eta(s).leftMs ?? 0), 0) : null;

  return (
    <section className="h-fit rounded-lg border border-line bg-surface lg:sticky lg:top-6">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">Investigation</h2>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">
          The agent reads every document, rebuilds the case history, checks what was actually completed, and prepares a recovery plan. Every citation is checked against the source text before the report is shown.
        </p>
      </div>

      <div className="px-4 py-3">
        {mode.kind === "demo" ? (
          <div className="rounded-md border border-amber/30 bg-amber-soft px-3 py-2 text-[12.5px] leading-snug text-amber">
            {mode.available ? (
              <><strong className="font-semibold">Demo mode.</strong> No AI is used. Documents are really read and every citation is really checked, but the analysis is a prepared example for this case.</>
            ) : (
              <><strong className="font-semibold">Demo mode.</strong> A prepared example analysis exists only for the Sarah Johnson case. Investigating this case needs AI mode.</>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-[12.5px] text-ink-2">
            AI analysis. Usually takes about {formatDuration(mode.typicalMs)}. You can keep working while it runs.
          </div>
        )}

        {documents.length === 0 && (
          <p className="mt-3 text-[12.5px] text-ink-3">Add the case documents first. The investigation reads only what is in the case file.</p>
        )}
        <button
          type="button" onClick={start} disabled={running || documents.length === 0 || (mode.kind === "demo" && !mode.available)}
          className="mt-3 w-full rounded-md bg-accent px-4 py-2.5 text-[14px] font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {running ? "Investigating…" : lastRun || view.completedRunId ? "Re-run investigation" : "Investigate case"}
        </button>
        {totalLeft !== null && !view.error && (
          <p className="mt-2 text-center text-[12.5px] text-ink-2 tabular">
            {totalLeft > 0 ? `About ${formatDuration(totalLeft)} remaining` : "Finishing up…"}
          </p>
        )}
        {lastRun && !started && (
          <p className="mt-2 text-center text-[12px] text-ink-3">
            Last run {formatDateTime(lastRun.completedAt)} · {lastRun.mode === "demo" ? "demo mode" : "AI"} · {lastRun.findings} findings
          </p>
        )}
      </div>

      {started && (
        <div className="border-t border-line px-4 py-3">
          <Step label="Read documents" status={view.stages.extract} detail={`${view.extracted}/${documents.length}`}>
            <ul className="mt-1.5 space-y-0.5">
              {view.docs.map(([id, d]) => (
                <li key={id} className="flex items-center gap-2 text-[12px]">
                  <StatusGlyph status={d.extract?.status === "completed" ? "completed" : d.extract?.status === "failed" ? "failed" : "started"} small />
                  <span className="w-11 shrink-0 truncate font-mono text-[11px] text-ink-3" title={id}>{id}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{d.title}</span>
                  <span className="shrink-0 text-[11px] text-ink-3 tabular">{d.analyze?.detail ?? d.extract?.detail}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step label="Analyse each document" status={view.stages.analyze} detail={view.stageDetail.analyze} time={eta("analyze")} />
          <Step label="Review the case history and identify issues" status={view.stages.synthesize} detail={view.stageDetail.synthesize} time={eta("synthesize")} />
          <Step label="Prepare work status and recovery plan" status={view.stages.plan} detail={view.stageDetail.plan} time={eta("plan")} />
          <Step label="Check every citation against the documents" status={view.stages.verify} detail={view.stageDetail.verify} />

          {view.notices.map((n, i) => (
            <div key={i} className="mt-2 rounded-md bg-amber-soft px-3 py-2 text-[12px] text-amber">{n}</div>
          ))}
          {lostConnection && (
            <div className="mt-2 rounded-md bg-amber-soft px-3 py-2 text-[12.5px] text-amber">
              Lost connection to the progress updates. The investigation keeps running and the report is saved when it finishes. Refresh this page in a few minutes.
            </div>
          )}
          {view.error && (
            <div className="mt-2 rounded-md bg-red-soft px-3 py-2 text-[12.5px] text-red">
              The investigation stopped before finishing. Steps that were already done are kept, so running it again continues from where it stopped.
              <span className="mt-1 block text-[11.5px] opacity-80">Details: {view.error}</span>
            </div>
          )}
          {view.completedRunId && (
            <div className="mt-3 flex items-center justify-between rounded-md border border-green/30 bg-green-soft px-3 py-2.5">
              <span className="text-[13px] font-medium text-green">Takeover report ready · {view.elapsed}</span>
              <Link href={`/cases/${caseId}/report`} className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white">Open report →</Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function summarise(events: InvestigationEvent[]) {
  const stages: Record<string, string | undefined> = {};
  const stageDetail: Record<string, string | undefined> = {};
  const stageStart: Record<string, number> = {};
  const stageEnd: Record<string, number> = {};
  const docs = new Map<string, DocProgress>();
  const notices: string[] = [];
  let estimates: Record<TimedStep, number> | null = null;
  let error: string | null = null;
  let completedRunId: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  for (const e of events) {
    if (e.type === "run_started") {
      startedAt = e.at;
      estimates = e.estimates ?? null;
    }
    if (e.type === "stage") {
      stages[e.stage] = e.status;
      if (e.detail) stageDetail[e.stage] = e.detail;
      if (e.status === "started") stageStart[e.stage] = new Date(e.at).getTime();
      else stageEnd[e.stage] = new Date(e.at).getTime();
    }
    if (e.type === "document") {
      const d = docs.get(e.docId) ?? { title: e.title };
      d[e.stage] = { status: e.status, detail: e.detail };
      docs.set(e.docId, d);
    }
    if (e.type === "notice") notices.push(e.message);
    if (e.type === "failed") {
      error = e.error;
      // Whatever was in progress when the run failed has stopped: show it as failed, not spinning.
      for (const k of Object.keys(stages)) if (stages[k] === "started") stages[k] = "failed";
      for (const d of docs.values())
        for (const st of ["extract", "analyze"] as const) if (d[st]?.status === "started") d[st] = { ...d[st]!, status: "failed" };
    }
    if (e.type === "completed") {
      completedRunId = e.runId;
      endedAt = e.at;
    }
  }
  const extracted = [...docs.values()].filter((d) => d.extract?.status === "completed" || d.extract?.status === "failed").length;
  const ms = startedAt && endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : 0;
  const elapsed = ms < 1000 ? `${ms} ms` : formatTook(ms);
  return { stages, stageDetail, stageStart, stageEnd, estimates, docs: [...docs.entries()], notices, error, completedRunId, extracted, elapsed };
}

type View = ReturnType<typeof summarise>;
interface StepTime { leftMs: number | null; label: string | null }

/** Time remaining for a step: its estimate if not started, a countdown while running, the actual time once done. */
function stepTime(view: View, step: TimedStep, nowMs: number): StepTime {
  const status = view.stages[step];
  const est = view.estimates?.[step];
  if (status === "completed" && view.stageStart[step] && view.stageEnd[step]) {
    const took = view.stageEnd[step] - view.stageStart[step];
    return { leftMs: 0, label: took >= 1000 ? `took ${formatTook(took)}` : null };
  }
  if (status === "skipped" || status === "failed" || est === undefined || view.error) return { leftMs: 0, label: null };
  if (status === "started") {
    const left = est - (nowMs - view.stageStart[step]);
    return { leftMs: Math.max(0, left), label: left > 0 ? `about ${formatDuration(left)} left` : "taking a little longer than usual…" };
  }
  return { leftMs: est, label: `about ${formatDuration(est)}` };
}

/** Rounded, human time for estimates: "less than a minute", "about 3 min". */
function formatDuration(ms: number) {
  const s = ms / 1000;
  if (s < 60) return "less than a minute";
  const m = Math.round(s / 60);
  return `${m} min`;
}

function formatTook(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

function Step({ label, status, detail, time, children }: { label: string; status?: string; detail?: string; time?: StepTime; children?: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="flex items-start gap-2">
        <StatusGlyph status={status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cx("text-[13px]", status ? "text-ink" : "text-ink-3")}>{label}</span>
            {time?.label && <span className={cx("shrink-0 text-[11.5px] tabular", status === "started" ? "text-accent" : "text-ink-3")}>{time.label}</span>}
          </div>
          {detail && <div className="text-[12px] text-ink-3">{detail}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

function StatusGlyph({ status, small }: { status?: string; small?: boolean }) {
  const s = small ? "h-3 w-3" : "mt-0.5 h-4 w-4";
  if (status === "completed")
    return <svg className={cx(s, "shrink-0 text-green")} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="currentColor" opacity=".14" /><path d="M5 8.2l2 2 4-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (status === "failed")
    return <svg className={cx(s, "shrink-0 text-red")} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="currentColor" opacity=".14" /><path d="M8 4.5v4.5M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  if (status === "skipped")
    return <svg className={cx(s, "shrink-0 text-ink-3")} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeDasharray="2 2" /><path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" /></svg>;
  if (status === "started")
    return <svg className={cx(s, "shrink-0 animate-spin text-accent")} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" /><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  return <span className={cx(s, "inline-block shrink-0 rounded-full border border-line-strong")} />;
}
