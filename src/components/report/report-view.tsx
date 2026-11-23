"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReportRun } from "@/lib/agent/types";
import type { FindingCategory } from "@/lib/schemas";
import type { CaseDetail, DecisionMap } from "@/lib/store";
import { EvidenceProvider } from "../evidence";
import { Badge, CATEGORY_META, Dot, cx, formatDateTime } from "../ui";
import { RecoveryPlan } from "./actions";
import { AuditSection, CompletedSection, FindingsSection, OutstandingSection, OverviewSection, TimelineSection } from "./sections";

export function ReportView({ caseDetail, run, initialDecisions }: { caseDetail: CaseDetail; run: ReportRun; initialDecisions: DecisionMap }) {
  const r = run.report;
  const [filter, setFilter] = useState<FindingCategory | "all">("all");
  const counts = Object.fromEntries(
    (Object.keys(CATEGORY_META) as FindingCategory[]).map((k) => [k, r.findings.filter((f) => f.category === k).length]),
  ) as Record<FindingCategory, number>;
  const analysed = run.documents.filter((d) => d.analysed).length;

  const nav = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline", count: r.timeline.length },
    { id: "findings", label: "Findings", count: r.findings.length },
    { id: "completed", label: "Completed work", count: r.completedWork.length },
    { id: "outstanding", label: "Outstanding work", count: r.outstandingWork.length },
    { id: "plan", label: "Recovery plan", count: r.recoveryPlan.length },
    { id: "audit", label: "Open questions & checks" },
  ];
  const active = useActiveSection(nav.map((n) => n.id));

  return (
    <EvidenceProvider caseId={caseDetail.id} documents={caseDetail.documents}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
        <Link href="/" className="font-medium text-ink-2 hover:text-accent">← All cases</Link>
        <span aria-hidden>/</span>
        <Link href={`/cases/${caseDetail.id}`} className="hover:text-accent">{caseDetail.clientName}</Link>
        <span aria-hidden>/</span>
        <span className="text-ink-2" aria-current="page">Takeover report</span>
      </nav>

      <header className="mt-2 border-b border-line pb-5">
        <div className="text-[12px] font-medium uppercase tracking-wide text-ink-3">Case takeover report</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
          {caseDetail.clientName} <span className="font-mono text-[15px] font-normal text-ink-3">{caseDetail.reference}</span>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2">
          {run.mode === "demo" ? (
            <Badge tone="amber">Demo mode · prepared example · no AI used</Badge>
          ) : (
            <Badge tone="accent">AI analysis · review before acting</Badge>
          )}
          <span>Generated {formatDateTime(run.completedAt)}</span>
          <span>{analysed} of {run.documents.length} documents analysed</span>
          <span className={run.verification.removedCitations.length ? "text-amber" : ""}>
            {run.verification.verifiedCitations} of {run.verification.totalCitations} citations verified against source text
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(Object.keys(CATEGORY_META) as FindingCategory[]).map((k) => (
            <a
              key={k} href="#findings" onClick={() => setFilter(k)}
              className="rounded-md border border-line bg-surface px-3 py-2 hover:border-line-strong"
            >
              <div className="flex items-center gap-2 text-[12.5px] text-ink-2"><Dot tone={CATEGORY_META[k].tone} />{CATEGORY_META[k].label}</div>
              <div className="mt-0.5 text-[20px] font-semibold tabular">{counts[k]}</div>
            </a>
          ))}
        </div>
      </header>

      {run.notices.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {run.notices.map((n, i) => <div key={i} className="rounded-md border border-amber/30 bg-amber-soft px-3 py-2 text-[12.5px] text-amber">{n}</div>)}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <ul className="sticky top-6 space-y-0.5 text-[13px]">
            {nav.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} className={cx("flex justify-between rounded px-2 py-1.5", active === n.id ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--color-accent)]" : "text-ink-2 hover:text-ink")}>
                  <span>{n.label}</span>
                  {n.count !== undefined && <span className="text-ink-3 tabular">{n.count}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          <OverviewSection report={r} />
          <TimelineSection report={r} />
          <FindingsSection report={r} filter={filter} setFilter={setFilter} counts={counts} recategorised={run.verification.recategorised ?? []} />
          <CompletedSection report={r} />
          <OutstandingSection report={r} />
          <RecoveryPlan caseId={caseDetail.id} runId={run.id} report={r} initialDecisions={initialDecisions} ctx={{ clientName: caseDetail.clientName, reference: caseDetail.reference }} />
          <AuditSection run={run} />
        </div>
      </div>
    </EvidenceProvider>
  );
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}
