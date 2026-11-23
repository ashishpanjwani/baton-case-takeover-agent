"use client";

import { useState } from "react";
import type { RecategorisedFinding } from "@/lib/agent/verify";
import type { ReportRun } from "@/lib/agent/types";
import type { Finding, FindingCategory, TakeoverReport } from "@/lib/schemas";
import { EvidenceList } from "../evidence";
import { Badge, CATEGORY_META, Dot, GAP_LABEL, PriorityLabel, SectionHeading, cx, formatDate, formatDateTime } from "../ui";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export function FindingLink({ id, report }: { id: string; report: TakeoverReport }) {
  const f = report.findings.find((x) => x.id === id);
  if (!f) return null;
  return (
    <a href={`#finding-${id}`} title={f.title} className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2 hover:border-line-strong">
      <Dot tone={CATEGORY_META[f.category].tone} />{id}
    </a>
  );
}

/* ---------------- Overview ---------------- */

export function OverviewSection({ report }: { report: TakeoverReport }) {
  const o = report.overview;
  return (
    <section>
      <SectionHeading id="overview" title="Case overview" />
      <p className="max-w-[820px] text-[15px] leading-[1.65] text-ink">{o.summary}</p>

      <dl className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line text-[13px] md:grid-cols-3">
        <div className="bg-surface px-4 py-3">
          <dt className="text-[11.5px] uppercase tracking-wide text-ink-3">Case type</dt>
          <dd className="mt-0.5">{o.caseType}</dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-[11.5px] uppercase tracking-wide text-ink-3">Current stage</dt>
          <dd className="mt-0.5">{o.currentStage}</dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-[11.5px] uppercase tracking-wide text-ink-3">Last meaningful activity</dt>
          <dd className="mt-0.5 font-medium tabular">{formatDate(o.lastMeaningfulActivity.date)}</dd>
        </div>
        <div className="bg-surface px-4 py-3 md:col-span-3">
          <p className="text-[13px] leading-relaxed text-ink-2">{o.lastMeaningfulActivity.description}</p>
          <div className="mt-1.5"><EvidenceList evidence={o.lastMeaningfulActivity.evidence} compact /></div>
        </div>
      </dl>

      <h3 className="mb-2 mt-7 text-[14px] font-semibold">Important events</h3>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {o.keyEvents.map((k, i) => (
          <li key={i} className="grid grid-cols-[100px_1fr] gap-4 px-4 py-2.5 text-[13.5px]">
            <span className="text-ink-3 tabular">{formatDate(k.date)}</span>
            <div>
              <div>{k.description}</div>
              <div className="mt-1"><EvidenceList evidence={k.evidence} compact /></div>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="mb-2 mt-7 text-[14px] font-semibold">Known providers</h3>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Dates of service</th>
              <th className="px-4 py-2 font-medium">Records</th>
              <th className="px-4 py-2 font-medium">Bills</th>
              <th className="px-4 py-2 font-medium">Sources</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {o.providers.map((p, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[12px] text-ink-3">{p.role}</div>
                </td>
                <td className="px-4 py-2.5 text-ink-2">{p.datesOfService}</td>
                <td className="px-4 py-2.5"><StatusText text={p.recordsStatus} /></td>
                <td className="px-4 py-2.5"><StatusText text={p.billsStatus} /></td>
                <td className="px-4 py-2.5"><div className="flex flex-col gap-1"><EvidenceList evidence={p.evidence} compact /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-7 text-[14px] font-semibold">Insurance</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {o.insurance.map((ins, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{ins.role}</div>
            <div className="mt-0.5 text-[14px] font-medium">{ins.carrier}</div>
            <div className="mt-1 font-mono text-[11.5px] text-ink-2">{ins.identifiers}</div>
            <p className="mt-2 text-[13px] leading-snug text-ink-2">{ins.details}</p>
            <div className="mt-2 flex flex-col gap-1"><EvidenceList evidence={ins.evidence} compact /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Light emphasis for status strings that start with a recognisable state word. */
function StatusText({ text }: { text: string }) {
  const t = text.toLowerCase();
  const tone = t.startsWith("received") ? "text-green" : t.startsWith("conflict") ? "text-violet" : t.startsWith("partial") || t.startsWith("not received") ? "text-red" : t.startsWith("not in file") || t.startsWith("listed") || t.startsWith("billed separately") ? "text-amber" : "text-ink-2";
  return <span className={cx("text-[13px]", tone)}>{text}</span>;
}

/* ---------------- Timeline ---------------- */

const TIMELINE_LABEL: Record<string, string> = {
  incident: "Incident", treatment: "Treatment", records_and_bills: "Records & bills", insurance: "Insurance", client_contact: "Client", administrative: "Admin",
};

export function TimelineSection({ report }: { report: TakeoverReport }) {
  const [cat, setCat] = useState<string>("all");
  const events = report.timeline.filter((t) => cat === "all" || t.category === cat);
  const groups: Array<{ month: string; items: typeof events }> = [];
  for (const e of events) {
    const m = e.date.slice(0, 7);
    if (groups.at(-1)?.month !== m) groups.push({ month: m, items: [] });
    groups.at(-1)!.items.push(e);
  }
  const cats = ["all", ...Object.keys(TIMELINE_LABEL).filter((k) => report.timeline.some((t) => t.category === k))];
  return (
    <section>
      <SectionHeading id="timeline" title="Reconstructed timeline" count={report.timeline.length}>
        <div className="flex flex-wrap gap-1">
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={cx("rounded px-2 py-1 text-[12px]", cat === c ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken")}>
              {c === "all" ? "All" : TIMELINE_LABEL[c]}
            </button>
          ))}
        </div>
      </SectionHeading>
      <p className="-mt-1 mb-4 text-[12.5px] text-ink-3">Built only from dated statements in the supplied documents. Entries marked client-reported come from conversation notes, not provider records.</p>
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.month}>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
              {new Date(`${g.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </div>
            <ol className="relative ml-[7px] border-l border-line-strong">
              {g.items.map((t, i) => (
                <li key={i} className="relative pb-4 pl-6 last:pb-1">
                  <span className="absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-full border-2 border-canvas bg-ink-3" />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="w-[86px] shrink-0 text-[13px] font-medium tabular">{formatDate(t.date)}</span>
                    <span className="text-[11.5px] uppercase tracking-wide text-ink-3">{TIMELINE_LABEL[t.category]}</span>
                    {t.relatedFindingIds.map((id) => <FindingLink key={id} id={id} report={report} />)}
                  </div>
                  <div className="mt-0.5 max-w-[760px] text-[13.5px] leading-snug text-ink">{t.description}</div>
                  <div className="mt-1"><EvidenceList evidence={t.evidence} compact /></div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Findings ---------------- */

export function FindingsSection({ report, filter, setFilter, counts, recategorised = [] }: {
  report: TakeoverReport; filter: FindingCategory | "all"; setFilter: (f: FindingCategory | "all") => void; counts: Record<FindingCategory, number>;
  recategorised?: RecategorisedFinding[];
}) {
  const list = report.findings
    .filter((f) => filter === "all" || f.category === filter)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.id.localeCompare(b.id, undefined, { numeric: true }));
  return (
    <section>
      <SectionHeading id="findings" title="Operational findings" count={report.findings.length} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All {report.findings.length}</FilterChip>
        {(Object.keys(CATEGORY_META) as FindingCategory[]).map((k) => (
          <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>
            <Dot tone={CATEGORY_META[k].tone} />{CATEGORY_META[k].label} {counts[k]}
          </FilterChip>
        ))}
      </div>
      {filter !== "all" && <p className="-mt-2 mb-3 text-[12.5px] text-ink-3">{CATEGORY_META[filter].description}</p>}
      <div className="space-y-3">
        {list.map((f) => <FindingCard key={f.id} f={f} report={report} change={recategorised.find((c) => c.id === f.id)} />)}
        {list.length === 0 && <p className="text-[13px] text-ink-3">No findings in this category.</p>}
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] tabular", active ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3")}>
      {children}
    </button>
  );
}

function FindingCard({ f, report, change }: { f: Finding; report: TakeoverReport; change?: RecategorisedFinding }) {
  const meta = CATEGORY_META[f.category];
  const actions = report.recoveryPlan.filter((a) => a.relatedFindingIds.includes(f.id));
  return (
    <article id={`finding-${f.id}`} className="scroll-mt-6 rounded-lg border border-line bg-surface target:ring-2 target:ring-accent/40">
      <div className="px-5 pb-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-[12px] text-ink-3">{GAP_LABEL[f.gapType]}</span>
          <span className="text-line-strong">·</span>
          <PriorityLabel p={f.priority} />
          <span className="ml-auto font-mono text-[12px] text-ink-3">{f.id}</span>
        </div>
        {change && (
          <p className="mt-2 text-[12px] text-ink-3">
            Category corrected from &ldquo;{CATEGORY_META[change.from].label}&rdquo; by the consistency check: no cited document states this gap.
          </p>
        )}
        <h3 className="mt-2 text-[16px] font-semibold leading-snug">{f.title}</h3>
        <p className="mt-1.5 max-w-[820px] text-[13.5px] leading-relaxed text-ink-2">{f.explanation}</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">Why it matters</div>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{f.operationalImpact}</p>
          </div>
          {f.couldNotEstablish && (
            <div>
              <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">Not established</div>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{f.couldNotEstablish}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-ink-3">Supporting evidence ({f.evidence.length})</div>
          <EvidenceList evidence={f.evidence} />
        </div>
      </div>
      <div className="flex items-start gap-4 rounded-b-lg border-t border-line bg-canvas/70 px-5 py-2.5 text-[13px]">
        <p className="min-w-0 flex-1 leading-snug text-ink-2"><span className="font-medium text-ink">Next step: </span>{f.recommendedNextStep}</p>
        {actions.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-[11.5px] text-ink-3">Plan</span>
            {actions.map((a) => (
              <a key={a.id} href={`#action-${a.id}`} className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11.5px] text-accent hover:border-accent/50">{a.id}</a>
            ))}
          </span>
        )}
      </div>
    </article>
  );
}

/* ---------------- Completed ---------------- */

export function CompletedSection({ report }: { report: TakeoverReport }) {
  return (
    <section>
      <SectionHeading id="completed" title="Completed work" count={report.completedWork.length} />
      <p className="-mt-1 mb-4 text-[12.5px] text-ink-3">
        A CMS task marked complete is not treated as enough on its own. Items are marked <em>outcome documented</em> only when a document shows the result.
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {report.completedWork.map((c) => (
          <li key={c.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_200px]">
            <div>
              <div className="flex items-start gap-2">
                <svg className="mt-[3px] h-3.5 w-3.5 shrink-0 text-green" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div>
                  <div className="text-[14px] font-medium">{c.title}</div>
                  <p className="mt-0.5 text-[13px] text-ink-2">{c.explanation}</p>
                  <div className="mt-1.5"><EvidenceList evidence={c.evidence} compact /></div>
                </div>
              </div>
            </div>
            <div className="md:text-right">
              {c.basis === "outcome_documented" ? <Badge tone="green">Outcome documented</Badge> : <Badge>Action documented · outcome pending</Badge>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Outstanding ---------------- */

export function OutstandingSection({ report }: { report: TakeoverReport }) {
  const groups = [
    { key: "confirmed_outstanding", title: "Confirmed outstanding", help: "The documents show this work is not finished." },
    { key: "status_unknown", title: "Status unknown", help: "The documents don't establish whether this was done." },
  ] as const;
  return (
    <section>
      <SectionHeading id="outstanding" title="Outstanding work" count={report.outstandingWork.length} />
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((g) => {
          const items = report.outstandingWork.filter((o) => o.status === g.key);
          return (
            <div key={g.key} className="rounded-lg border border-line bg-surface">
              <div className="border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  {g.key === "confirmed_outstanding" ? <Dot tone="red" /> : <Dot tone="slate" />}
                  {g.title} <span className="font-normal text-ink-3 tabular">{items.length}</span>
                </div>
                <div className="text-[12px] text-ink-3">{g.help}</div>
              </div>
              <ul className="divide-y divide-line">
                {items.map((o) => (
                  <li key={o.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13.5px] font-medium">{o.title}</div>
                      <div className="flex shrink-0 gap-1">{o.relatedFindingIds.map((id) => <FindingLink key={id} id={id} report={report} />)}</div>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-2">{o.explanation}</p>
                    <div className="mt-1"><EvidenceList evidence={o.evidence} compact /></div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Open questions & checks ---------------- */

/**
 * Renders one limitation: a leading "Topic:" in bold, and finding ids such as
 * "(F1)" or "(F8, F20)" as links to those findings.
 */
function LimitationText({ text, report }: { text: string; report: TakeoverReport }) {
  const m = /^([^:.]{2,60}):\s+(.*)$/s.exec(text);
  const topic = m ? m[1] : null;
  const body = m ? m[2] : text;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const g of body.matchAll(/\s*\((F\d+(?:\s*,\s*F\d+)*)\)/g)) {
    parts.push(body.slice(last, g.index));
    const ids = g[1].split(/\s*,\s*/).filter((id) => report.findings.some((f) => f.id === id));
    if (ids.length) parts.push(<span key={g.index} className="ml-1 inline-flex gap-1 align-middle">{ids.map((id) => <FindingLink key={id} id={id} report={report} />)}</span>);
    last = g.index! + g[0].length;
  }
  parts.push(body.slice(last));
  return (
    <>
      {topic && <span className="font-medium text-ink">{topic}: </span>}
      {parts}
    </>
  );
}

export function AuditSection({ run }: { run: ReportRun }) {
  const v = run.verification;
  return (
    <section>
      <SectionHeading id="audit" title="Open questions & checks" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <h3 className="text-[14px] font-semibold">Not established from the records</h3>
          <ul className="mt-2 space-y-2 text-[13px] leading-snug text-ink-2">
            {run.report.limitations.map((l, i) => <li key={i}><LimitationText text={l} report={run.report} /></li>)}
          </ul>
          <p className="mt-3 border-t border-line pt-2 text-[12px] text-ink-3">
            This report covers case operations only. Legal questions, including the effect of liability, policy limits or coverage, and any assessment of case value are for the assigned attorney.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <h3 className="text-[14px] font-semibold">Citation verification</h3>
          <p className="mt-1 text-[13px] text-ink-2">
            Every cited excerpt was matched against the text extracted from the cited document. Unmatched citations are removed, and any item left without support is withheld from the report.
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Citations checked" value={v.totalCitations} />
            <Stat label="Verified" value={v.verifiedCitations} />
            <Stat label="Removed" value={v.removedCitations.length} warn={v.removedCitations.length > 0} />
          </dl>
          {v.removedCitations.length > 0 && (
            <details className="mt-3 text-[12.5px]">
              <summary className="cursor-pointer text-ink-2">Removed citations ({v.removedCitations.length})</summary>
              <ul className="mt-1.5 space-y-1">
                {v.removedCitations.map((c, i) => (
                  <li key={i} className="rounded bg-sunken px-2 py-1 text-ink-2">
                    <span className="font-mono text-[11px]">{c.docId}</span> · {c.reason === "unknown_document" ? "unknown document" : "excerpt not found"} · {c.location}<br />“{c.quote}”
                  </li>
                ))}
              </ul>
            </details>
          )}
          {(v.recategorised?.length ?? 0) > 0 && (
            <details className="mt-2 text-[12.5px]" open>
              <summary className="cursor-pointer text-ink-2">Category corrected by the consistency check ({v.recategorised!.length})</summary>
              <p className="mt-1 text-ink-3">&ldquo;Confirmed incomplete&rdquo; requires a document that states the gap. These findings rested on the absence of a record, so they were moved to a weaker category.</p>
              <ul className="mt-1.5 list-disc pl-4 text-ink-2">
                {v.recategorised!.map((c) => (
                  <li key={c.id}>{c.id}: {c.title} · {CATEGORY_META[c.from].label} → {CATEGORY_META[c.to].label}</li>
                ))}
              </ul>
            </details>
          )}
          {v.rejectedItems.length > 0 && (
            <details className="mt-2 text-[12.5px]" open>
              <summary className="cursor-pointer text-amber">Withheld for lack of verified evidence ({v.rejectedItems.length})</summary>
              <ul className="mt-1.5 list-disc pl-4 text-ink-2">
                {v.rejectedItems.map((r, i) => <li key={i}>{r.section}{r.id ? ` ${r.id}` : ""}: {r.title}</li>)}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-surface">
        <div className="px-4 py-2.5">
          <h3 className="text-[14px] font-semibold">Documents reviewed</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Prepared {formatDateTime(run.completedAt)}{run.mode === "demo" ? " · demo mode (prepared example, no AI used)" : ""}</p>
        </div>
        <ul className="grid gap-x-6 gap-y-0.5 border-t border-line px-4 py-2.5 text-[12.5px] text-ink-2 md:grid-cols-2">
          {run.documents.map((d) => (
            <li key={d.docId} className="flex justify-between gap-2">
              <span className="truncate"><span className="font-mono text-[11px] text-ink-3">{d.docId}</span> {d.title}</span>
              <span className={cx("shrink-0", d.analysed ? "text-ink-3" : "text-amber")}>
                {d.analysed ? `${d.pages > 1 ? `${d.pages} pages` : "reviewed"}${d.ocrPages?.length ? " · scanned" : ""}` : "not analysed"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-md bg-sunken px-2 py-2">
      <div className={cx("text-[18px] font-semibold tabular", warn && "text-amber")}>{value}</div>
      <div className="text-[11.5px] text-ink-3">{label}</div>
    </div>
  );
}
