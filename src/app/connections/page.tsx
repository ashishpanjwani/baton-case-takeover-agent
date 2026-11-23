import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { CONNECTIONS } from "@/lib/integrations";

export const metadata: Metadata = { title: "Connections · Case Takeover Agent" };

const FLOW = [
  { title: "Case reassigned in the CMS", manual: "You open the case here", connected: "The CMS tells the agent a case has a new owner" },
  { title: "Case file gathered", manual: "You upload the export", connected: "Notes, tasks, contacts, correspondence and documents are read directly, including files the review package left out" },
  { title: "Investigation", manual: "Same", connected: "Same: every finding cited to a page and checked" },
  { title: "You review the report", manual: "Same", connected: "Same. Nothing happens without your approval" },
  { title: "Approved actions carried out", manual: "You copy or download drafts and tasks", connected: "Tasks created, emails put in your Drafts, letters ready to sign, requests submitted" },
  { title: "Kept current", manual: "Re-upload and re-run", connected: "New records and replies are picked up, and findings they resolve are marked" },
];

export default function ConnectionsPage() {
  return (
    <div className="max-w-[1040px]">
      <Link href="/" className="text-[13px] text-ink-3 hover:text-accent">← Cases</Link>
      <h1 className="mt-2 text-[24px] font-semibold tracking-tight">Connections</h1>
      <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
        This prototype is not connected to any of the firm’s systems, so some steps are done by hand. This page shows what each connection would do, what the firm would need to set it up, and what always stays with a person.
      </p>
      <div className="mt-3 rounded-md border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink-2">
        <strong className="font-medium text-ink">Connected or not, the agent never sends anything, contacts anyone or changes a record by itself.</strong> Each action waits for your approval, and emails and letters are always sent by a person.
      </div>

      <section className="mt-8">
        <h2 className="text-[17px] font-semibold tracking-tight">How a takeover runs</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line bg-sunken/60 text-[12px] uppercase tracking-wide text-ink-3">
              <tr>
                <th className="w-8 px-4 py-2 font-medium" />
                <th className="px-4 py-2 font-medium">Step</th>
                <th className="px-4 py-2 font-medium">In this prototype</th>
                <th className="px-4 py-2 font-medium">With connections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {FLOW.map((f, i) => (
                <tr key={f.title}>
                  <td className="px-4 py-2.5 align-top font-mono text-[12px] text-ink-3">{i + 1}</td>
                  <td className="px-4 py-2.5 align-top font-medium text-ink">{f.title}</td>
                  <td className="px-4 py-2.5 align-top text-ink-2">{f.manual}</td>
                  <td className="px-4 py-2.5 align-top text-ink-2">{f.connected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[17px] font-semibold tracking-tight">Systems</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {CONNECTIONS.map((c) => (
            <article key={c.id} id={c.id} className="scroll-mt-6 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold">{c.name}</h3>
                  <p className="text-[12px] text-ink-3">{c.examples}</p>
                </div>
                <Badge>Not connected</Badge>
              </div>
              <p className="mt-3 text-[12.5px] text-ink-2"><span className="font-medium text-ink">Today: </span>{c.today}</p>
              <List title="With a connection" items={c.unlocks} />
              <List title="What the firm needs" items={c.needs} />
              <List title="Always done by a person" items={c.staysWithPerson} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] leading-snug text-ink-2">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}
