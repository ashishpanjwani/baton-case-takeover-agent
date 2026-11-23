"use client";

import Link from "next/link";
import { useState } from "react";
import type { FindingCategory } from "@/lib/schemas";
import { Badge, CATEGORY_META, Dot, cx, formatDate, formatDateTime } from "./ui";

export type BoardStatus = "report" | "ready" | "empty";

export interface BoardRow {
  id: string;
  clientName: string;
  reference: string;
  caseType: string;
  stage: string;
  lastUpdate: string;
  lastUpdateBasis: string;
  daysSinceUpdate: number | null;
  openCmsTasks: number | null;
  documentCount: number;
  status: BoardStatus;
  report: {
    completedAt: string;
    demo: boolean;
    top: { title: string; category: FindingCategory } | null;
    high: number;
    total: number;
    stale: boolean;
  } | null;
}

const FILTERS: { key: BoardStatus | "all"; label: string }[] = [
  { key: "all", label: "All cases" },
  { key: "report", label: "Investigated" },
  { key: "ready", label: "Ready to investigate" },
  { key: "empty", label: "Need documents" },
];

/** Days without a meaningful update after which the date is highlighted. */
const STALE_DAYS = 45;

const GROUP: Record<BoardStatus, number> = { report: 0, ready: 1, empty: 2 };

/** Most in need of attention first: investigated cases (out-of-date reports, then most high-priority issues), then ready, then empty. */
function ordered(rows: BoardRow[]) {
  return [...rows].sort((a, b) =>
    GROUP[a.status] - GROUP[b.status]
    || Number(!!b.report?.stale) - Number(!!a.report?.stale)
    || (b.report?.high ?? 0) - (a.report?.high ?? 0)
    || (b.daysSinceUpdate ?? 0) - (a.daysSinceUpdate ?? 0));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function CaseBoard({ rows }: { rows: BoardRow[] }) {
  const [filter, setFilter] = useState<BoardStatus | "all">("all");
  const count = (k: BoardStatus | "all") => (k === "all" ? rows.length : rows.filter((r) => r.status === k).length);
  const shown = ordered(filter === "all" ? rows : rows.filter((r) => r.status === filter));

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filter cases">
        {FILTERS.map((f) => (
          <button
            key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={cx(
              "rounded-full border px-3 py-1 text-[13px] font-medium",
              filter === f.key ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-ink-2 hover:border-accent hover:text-accent",
            )}
          >
            {f.label} <span className={cx("ml-1 tabular", filter === f.key ? "text-white/80" : "text-ink-3")}>{count(f.key)}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[920px] text-left text-[13.5px]">
          <thead className="border-b border-line bg-sunken/60 text-[12px] uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium">Case</th>
              <th className="px-4 py-2.5 font-medium">Last update</th>
              <th className="w-[34%] px-4 py-2.5 font-medium">Needs attention</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => <Row key={r.id} r={r} />)}
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-ink-3">No cases here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ r }: { r: BoardRow }) {
  // Every reassigned case is somewhat stale; highlight only those left the longest.
  const old = (r.daysSinceUpdate ?? 0) > STALE_DAYS;
  return (
    <tr className="align-top hover:bg-canvas">
      <td className="px-4 py-3.5">
        <div className="whitespace-nowrap font-medium text-ink">{r.clientName}</div>
        <div className="font-mono text-[12px] text-ink-3">{r.reference}</div>
      </td>
      <td className="px-4 py-3.5">
        <div className="text-ink">{r.caseType}</div>
        <div className="text-[12px] text-ink-3">{r.stage}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 tabular">
        <div>{formatDate(r.lastUpdate)}</div>
        {r.daysSinceUpdate !== null && (
          <div className={cx("text-[12px]", old ? "font-medium text-amber" : "text-ink-3")}>
            {r.daysSinceUpdate === 0 ? "today" : `${plural(r.daysSinceUpdate, "day")} ago`}
            {old && " · no activity"}
          </div>
        )}
        <div className="text-[11.5px] text-ink-3">{r.lastUpdateBasis}</div>
      </td>
      <td className="px-4 py-3.5">
        <Attention r={r} />
      </td>
      <td className="px-4 py-3.5 text-right">
        <Action r={r} />
      </td>
    </tr>
  );
}

function Attention({ r }: { r: BoardRow }) {
  if (r.status === "empty") return <span className="text-[13px] text-ink-3">No case file yet. Add its documents to investigate.</span>;
  if (r.status === "ready")
    return (
      <div className="text-[13px] text-ink-2">
        Not yet investigated
        <div className="text-[12px] text-ink-3">
          {r.documentCount} documents{r.openCmsTasks !== null ? ` · ${plural(r.openCmsTasks, "open task")} in the CMS` : ""}
        </div>
      </div>
    );
  const rep = r.report!;
  return (
    <div>
      {rep.top ? (
        <div className="flex items-start gap-2">
          <span className="mt-[5px]" title={CATEGORY_META[rep.top.category].label}><Dot tone={CATEGORY_META[rep.top.category].tone} /></span>
          <span className="font-medium leading-snug text-ink">{rep.top.title}</span>
        </div>
      ) : (
        <span className="text-ink-2">No issues found</span>
      )}
      <div className="mt-1 pl-4 text-[12px] text-ink-3">
        {rep.high > 0 && <span className="font-medium text-ink-2">{rep.high} high priority</span>}
        {rep.high > 0 && " · "}
        {plural(rep.total, "finding")}
      </div>
      {rep.stale && (
        <div className="mt-1.5 rounded bg-amber-soft px-2 py-1 text-[12px] text-amber">
          New documents were added after this report. Re-run the investigation to include them.
        </div>
      )}
    </div>
  );
}

function Action({ r }: { r: BoardRow }) {
  if (r.status === "empty")
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge>Awaiting documents</Badge>
        <Link href={`/cases/${r.id}`} className="mt-1 inline-block whitespace-nowrap rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:border-accent hover:text-accent">
          Add documents
        </Link>
      </div>
    );
  if (r.status === "ready")
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge tone="accent">Ready to investigate</Badge>
        <Link href={`/cases/${r.id}`} className="mt-1 inline-block whitespace-nowrap rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-accent hover:bg-accent hover:text-white">
          Open to investigate
        </Link>
      </div>
    );
  const rep = r.report!;
  return (
    <div className="flex flex-col items-end gap-1">
      <Badge tone="green">Report ready{rep.demo ? " · demo" : ""}</Badge>
      <span className="whitespace-nowrap text-[11.5px] text-ink-3">{formatDateTime(rep.completedAt)}</span>
      <Link href={`/cases/${r.id}/report`} className="mt-0.5 inline-block whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent/90">
        View report
      </Link>
      <Link href={`/cases/${r.id}`} className="text-[12px] text-ink-3 hover:text-accent">Open case</Link>
    </div>
  );
}
