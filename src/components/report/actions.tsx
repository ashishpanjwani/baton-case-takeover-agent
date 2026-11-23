"use client";

import Link from "next/link";
import { useState } from "react";
import { type ActionContext, type ActionStep, connectionById, stepsFor, tasksCsv } from "@/lib/integrations";
import type { RecoveryAction, TakeoverReport } from "@/lib/schemas";
import type { ActionDecision, DecisionMap } from "@/lib/store";
import { EvidenceList } from "../evidence";
import { Badge, PriorityLabel, SectionHeading, cx, formatDateTime } from "../ui";
import { FindingLink } from "./sections";

const DRAFT_LABEL = { email: "Draft email", letter: "Draft letter", call_script: "Call script", internal_note: "Draft internal note" } as const;

export function RecoveryPlan({ caseId, runId, report, initialDecisions, ctx }: { caseId: string; runId: string; report: TakeoverReport; initialDecisions: DecisionMap; ctx: ActionContext }) {
  const [decisions, setDecisions] = useState<DecisionMap>(initialDecisions);
  const reviewed = Object.keys(decisions).length;
  const approved = Object.values(decisions).filter((d) => d.status === "approved").length;

  async function decide(actionId: string, status: ActionDecision["status"] | null, extra: { note?: string; editedDraftBody?: string | null } = {}) {
    const r = await fetch(`/api/cases/${caseId}/runs/${runId}/decisions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, status, note: extra.note || null, editedDraftBody: extra.editedDraftBody ?? null }),
    });
    if (!r.ok) return;
    const { decision } = await r.json();
    setDecisions((d) => {
      const n = { ...d };
      if (decision) n[actionId] = decision;
      else delete n[actionId];
      return n;
    });
  }

  return (
    <section>
      <SectionHeading id="plan" title="Recovery plan" count={report.recoveryPlan.length}>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <span className="text-[12.5px] text-ink-3 tabular">{reviewed} of {report.recoveryPlan.length} reviewed · {approved} approved</span>
          <button
            type="button"
            title="Every action not dismissed, as a task list you can import into the CMS"
            onClick={() => {
              const keep = report.recoveryPlan.filter((a) => decisions[a.id]?.status !== "dismissed");
              download(`${ctx.reference.toLowerCase()}-tasks.csv`, tasksCsv(keep, ctx, new Date()), "text/csv");
            }}
            className="rounded-md border border-line-strong px-2.5 py-1 text-[12.5px] font-medium hover:border-accent hover:text-accent"
          >
            Download tasks (CSV)
          </button>
        </div>
      </SectionHeading>
      <div className="mb-4 flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink-2">
        <svg className="mt-[1px] h-4 w-4 shrink-0 text-accent" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><path d="M8 7v4M8 5v.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span>
          These are suggestions for you to review. Approving or dismissing an action only records your decision in this prototype. <strong className="font-medium text-ink">Nothing is sent to anyone, and no CMS record is changed.</strong> Drafts use only facts from the case file. Fill in anything in [brackets] before you use one.
        </span>
      </div>
      <ol className="space-y-3">
        {report.recoveryPlan.map((a) => (
          <ActionCard key={a.id} a={a} report={report} decision={decisions[a.id]} onDecide={decide} ctx={ctx} />
        ))}
      </ol>
    </section>
  );
}

function ActionCard({ a, report, decision, onDecide, ctx }: {
  a: RecoveryAction; report: TakeoverReport; decision?: ActionDecision; ctx: ActionContext;
  onDecide: (id: string, s: ActionDecision["status"] | null, extra?: { note?: string; editedDraftBody?: string | null }) => Promise<void>;
}) {
  const [showDraft, setShowDraft] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [body, setBody] = useState(decision?.editedDraftBody ?? a.draft?.body ?? "");
  const [note, setNote] = useState(decision?.note ?? "");
  const [busy, setBusy] = useState(false);
  const decided = !!decision;
  const edited = a.draft && body !== a.draft.body;

  const act = async (s: ActionDecision["status"] | null) => {
    setBusy(true);
    await onDecide(a.id, s, { note, editedDraftBody: edited ? body : null });
    setBusy(false);
  };

  return (
    <li id={`action-${a.id}`} className={cx("scroll-mt-6 rounded-lg border bg-surface", decision?.status === "approved" ? "border-green/40" : "border-line", decision?.status === "dismissed" && "opacity-60")}>
      <div className="grid gap-4 px-5 py-4 md:grid-cols-[32px_minmax(0,1fr)]">
        <div className="hidden h-8 w-8 place-items-center rounded-full border border-line-strong text-[13px] font-semibold tabular text-ink-2 md:grid">{a.order}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityLabel p={a.priority} />
            <span className="text-line-strong">·</span>
            <span className="text-[12px] text-ink-2">Owner: {a.suggestedOwner}</span>
            {a.requiresApproval ? <Badge tone="accent">Requires approval</Badge> : <Badge>Internal · no approval needed</Badge>}
            <span className="ml-auto font-mono text-[12px] text-ink-3">{a.id}</span>
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{a.action}</h3>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">{a.rationale}</p>
          {a.ownerBasis && <p className="mt-1 text-[12px] text-ink-3">Why this owner: {a.ownerBasis}</p>}
          {a.requiresApproval && a.approvalReason && <p className="mt-0.5 text-[12px] text-ink-3">Why approval: {a.approvalReason}</p>}

          {(a.evidence.length > 0 || a.relatedFindingIds.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {a.relatedFindingIds.map((id) => <FindingLink key={id} id={id} report={report} />)}
              <EvidenceList evidence={a.evidence} compact />
            </div>
          )}

          {a.draft && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowDraft((s) => !s)} className="text-[12.5px] font-medium text-accent">
                {showDraft ? "Hide" : "Show"} {DRAFT_LABEL[a.draft.kind].toLowerCase()}{edited ? " (edited)" : ""}
              </button>
              {showDraft && (
                <div className="mt-2 rounded-md border border-line bg-canvas">
                  <div className="border-b border-line px-3 py-2 text-[12px] text-ink-2">
                    <div><span className="text-ink-3">To:</span> {a.draft.to}</div>
                    {a.draft.subject && <div><span className="text-ink-3">Subject:</span> {a.draft.subject}</div>}
                  </div>
                  <textarea
                    value={body} onChange={(e) => setBody(e.target.value)} disabled={decided}
                    rows={Math.min(18, body.split("\n").length + 2)}
                    className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink outline-none disabled:text-ink-2"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <button type="button" onClick={() => setShowSteps((s) => !s)} className="text-[12.5px] font-medium text-accent">
              {showSteps ? "Hide" : "How to carry this out"}
            </button>
            {showSteps && <CarryOut steps={stepsFor(a, ctx, body, new Date())} approved={decision?.status === "approved"} />}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            {!decided ? (
              <>
                <input
                  value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note"
                  className="min-w-[180px] flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-accent"
                />
                <button type="button" disabled={busy} onClick={() => act("dismissed")} className="rounded-md border border-line-strong px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:bg-sunken disabled:opacity-50">Dismiss</button>
                <button type="button" disabled={busy} onClick={() => act("approved")} className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-accent/90 disabled:opacity-50">Approve</button>
              </>
            ) : (
              <>
                <span className={cx("text-[12.5px] font-medium", decision.status === "approved" ? "text-green" : "text-ink-3")}>
                  {decision.status === "approved" ? "Approved" : "Dismissed"} · {formatDateTime(decision.decidedAt)}
                  {decision.status === "approved" && " · recorded only, nothing sent"}
                </span>
                {decision.note && <span className="text-[12.5px] text-ink-3">“{decision.note}”</span>}
                <button type="button" disabled={busy} onClick={() => act(null)} className="ml-auto text-[12.5px] text-accent">Undo</button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function download(filename: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const el = document.createElement("a");
  el.href = url;
  el.download = filename;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Each step of an action: what a connection would do, and how to do it here today. */
function CarryOut({ steps, approved }: { steps: ActionStep[]; approved: boolean }) {
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-line">
      <div className="hidden grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line bg-sunken/60 px-3 py-1.5 text-[11.5px] font-medium uppercase tracking-wide text-ink-3 md:grid">
        <span>System</span>
        <span>With a connection</span>
        <span>In this prototype, today</span>
      </div>
      <ol className="divide-y divide-line">
        {steps.map((s, i) => {
          const c = connectionById(s.connection);
          return (
            <li key={i} className="grid gap-x-4 gap-y-1.5 px-3 py-2.5 text-[12.5px] md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <div className="font-medium text-ink">{c.name}</div>
                <Badge className="mt-1">Not connected</Badge>
              </div>
              <p className="leading-snug text-ink-2">
                <span className="font-medium text-ink-3 md:hidden">With a connection: </span>
                {s.connected}
                {i === 0 && (
                  <span className="mt-1 block text-[11.5px] text-ink-3">
                    {approved ? "Approved, so a connected system would run this now." : "Runs only after you approve the action."}
                  </span>
                )}
              </p>
              <div className="leading-snug text-ink-2">
                <span className="font-medium text-ink-3 md:hidden">Today: </span>
                {s.manual}
                {s.file && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => download(s.file!.filename, s.file!.content, s.file!.filename.endsWith(".eml") ? "message/rfc822" : "text/plain")} className="rounded border border-line-strong px-2 py-0.5 text-[12px] font-medium hover:border-accent hover:text-accent">
                      {s.file.label}
                    </button>
                    <CopyButton text={s.file.content} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line bg-canvas px-3 py-2 text-[11.5px] text-ink-3">
        No systems are connected in this prototype. <Link href="/connections" className="text-accent">What each connection would do</Link>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the download still works */
        }
      }}
      className="rounded border border-line-strong px-2 py-0.5 text-[12px] font-medium hover:border-accent hover:text-accent"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
