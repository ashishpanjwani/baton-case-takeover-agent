import Link from "next/link";
import { Badge, formatDate } from "@/components/ui";
import { latestRun, listCases } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const cases = await listCases();
  const runs = await Promise.all(cases.map((c) => latestRun(c.id)));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Cases awaiting reassignment</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
          These cases were handled by Dana Whitfield, who has left the firm. Open a case to have the agent investigate its history and prepare a takeover report.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[1040px] text-left text-[13.5px]">
          <thead className="border-b border-line bg-sunken/60 text-[12px] uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium">Case type</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Previous case manager</th>
              <th className="px-4 py-2.5 font-medium">Last meaningful update</th>
              <th className="px-4 py-2.5 font-medium">Outstanding</th>
              <th className="px-4 py-2.5 font-medium">Investigation</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cases.map((c, i) => {
              const run = runs[i];
              const openFindings = run?.report.findings.length;
              return (
                <tr key={c.id} className="hover:bg-canvas">
                  <td className="px-4 py-3.5">
                    <div className="whitespace-nowrap font-medium text-ink">{c.clientName}</div>
                    <div className="font-mono text-[12px] text-ink-3">{c.reference}</div>
                  </td>
                  <td className="px-4 py-3.5">{c.caseType}</td>
                  <td className="px-4 py-3.5">{c.stage}</td>
                  <td className="px-4 py-3.5">{c.previousCaseManager}</td>
                  <td className="px-4 py-3.5 tabular">
                    {formatDate(c.lastMeaningfulUpdate)}
                    <div className="text-[12px] text-ink-3">{c.lastUpdateBasis}</div>
                  </td>
                  <td className="px-4 py-3.5 tabular">
                    {openFindings !== undefined ? (
                      <span>{openFindings} findings</span>
                    ) : c.openCmsTasks !== null ? (
                      <span>{c.openCmsTasks} open CMS tasks</span>
                    ) : (
                      <span className="text-ink-3">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {c.documentCount === 0 ? (
                      <Badge>Awaiting documents</Badge>
                    ) : run ? (
                      <Badge tone="green">Report ready{run.mode === "demo" ? " · demo" : ""}</Badge>
                    ) : (
                      <Badge tone="accent">Ready to investigate</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/cases/${c.id}`} className="whitespace-nowrap rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-accent hover:text-accent">
                      {c.documentCount === 0 ? "Open and add documents" : "Open case"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        All clients, providers, insurers and the firm shown here are fictional. Cases marked &ldquo;Awaiting documents&rdquo; have no case file yet: open one and upload its documents to investigate it.
      </p>
    </div>
  );
}
