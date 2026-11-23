import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { toReportRun } from "@/lib/agent/types";
import { getCase, getDecisions, latestRun } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  if (!c) notFound();
  const run = await latestRun(id);
  if (!run) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-[14px] text-ink-2">No investigation has been run for this case yet.</p>
        <Link href={`/cases/${id}`} className="mt-3 inline-block text-[14px] font-medium text-accent">Go to the case and start an investigation →</Link>
      </div>
    );
  }
  const decisions = await getDecisions(id, run.id);
  return <ReportView caseDetail={c} run={toReportRun(run)} initialDecisions={decisions} />;
}
