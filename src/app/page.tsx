import { CaseBoard, type BoardRow } from "@/components/case-board";
import type { Finding, Priority } from "@/lib/schemas";
import { storageIsPersistent } from "@/lib/durable";
import { latestRun, listCases } from "@/lib/store";

export const dynamic = "force-dynamic";

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** The finding to lead with: the highest priority, then the order the report gives (F1 first). */
function topFinding(findings: Finding[]) {
  return [...findings].map((f, i) => ({ f, i })).sort((a, b) => RANK[a.f.priority] - RANK[b.f.priority] || a.i - b.i)[0]?.f ?? null;
}

/** Whole days between a YYYY-MM-DD date and today (UTC, no time-zone drift). */
function daysSince(from: string, to: Date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(from);
  if (!m) return null;
  const a = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export default async function CasesPage() {
  const cases = await listCases();
  const runs = await Promise.all(cases.map((c) => latestRun(c.id)));
  const today = new Date();

  const rows: BoardRow[] = cases.map((c, i) => {
    const run = runs[i];
    const top = run ? topFinding(run.report.findings) : null;
    return {
      id: c.id,
      clientName: c.clientName,
      reference: c.reference,
      caseType: c.caseType,
      stage: c.stage,
      lastUpdate: c.lastMeaningfulUpdate,
      lastUpdateBasis: c.lastUpdateBasis,
      daysSinceUpdate: daysSince(c.lastMeaningfulUpdate, today),
      openCmsTasks: c.openCmsTasks,
      documentCount: c.documentCount,
      status: c.documentCount === 0 ? "empty" : run ? "report" : "ready",
      report: run
        ? {
            completedAt: run.completedAt,
            demo: run.mode === "demo",
            top: top ? { title: top.title, category: top.category } : null,
            high: run.report.findings.filter((f) => f.priority === "high").length,
            total: run.report.findings.length,
            // Documents were uploaded after this report was made.
            stale: !!c.latestUploadAt && c.latestUploadAt > run.completedAt,
          }
        : null,
    };
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[24px] font-semibold tracking-tight">Cases reassigned to you</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
          These cases were handled by Dana Whitfield, who has left the firm. For each one, the agent investigates the file and prepares a takeover report: what is done, what is not, and what to do first.
        </p>
      </div>
      {!storageIsPersistent() && (
        <div className="mb-4 rounded-md border border-amber/30 bg-amber-soft px-3 py-2.5 text-[13px] text-amber">
          <strong className="font-semibold">Reports are not being saved on this deployment.</strong> It runs on servers with temporary storage, so a finished report can vanish before you open it. Connect a Vercel Blob store to the project (Storage → Blob), then redeploy.
        </div>
      )}
      <CaseBoard rows={rows} />
      <p className="mt-3 text-[12px] text-ink-3">
        All clients, providers, insurers and the firm shown here are fictional. &ldquo;Needs attention&rdquo; shows the most important problem in the latest report. Cases without a report show the open tasks recorded in the CMS.
      </p>
    </div>
  );
}
