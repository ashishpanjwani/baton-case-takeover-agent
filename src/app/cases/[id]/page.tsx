import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseWorkspace } from "@/components/case-workspace";
import { formatDate } from "@/components/ui";
import { getDemoReport } from "@/lib/agent/demo-report";
import { investigationMethod } from "@/lib/agent/engine";
import { estimateSteps, totalEstimate } from "@/lib/agent/eta";
import { getProvider } from "@/lib/llm";
import { getCase, latestRun } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  if (!c) notFound();
  const run = await latestRun(id);
  const provider = getProvider();
  const method = investigationMethod(provider);
  const est = provider ? await estimateSteps(id, provider, c.documents.length, method) : null;
  const typicalMs = est ? totalEstimate(est) : null;

  return (
    <div>
      <Link href="/" className="text-[13px] text-ink-3 hover:text-accent">← All cases</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">{c.clientName}</h1>
          <div className="mt-0.5 text-[14px] text-ink-2">
            <span className="font-mono text-[13px]">{c.reference}</span> · {c.caseType}
          </div>
        </div>
        {run && (
          <Link href={`/cases/${id}/report`} className="rounded-md bg-accent px-3.5 py-2 text-[13.5px] font-medium text-white hover:bg-accent/90">
            View latest takeover report →
          </Link>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-[13px] md:grid-cols-5">
        {[
          ["Current stage", c.stage],
          ["Previous case manager", c.previousCaseManager],
          ["Assigned attorney", c.assignedAttorney ?? "—"],
          ["Reassigned", formatDate(c.reassignedOn)],
          ["Last meaningful update", `${formatDate(c.lastMeaningfulUpdate)} (${c.lastUpdateBasis})`],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <dt className="text-[11.5px] uppercase tracking-wide text-ink-3">{k}</dt>
            <dd className="mt-0.5 text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <CaseWorkspace
        caseId={id}
        documents={c.documents}
        mode={provider ? { kind: "ai", typicalMs: typicalMs!, method } : { kind: "demo", available: getDemoReport(id) !== null }}
        lastRun={run ? { id: run.id, completedAt: run.completedAt, mode: run.mode, findings: run.report.findings.length } : null}
      />
    </div>
  );
}
