import type { FindingCategory, GapType, Priority } from "@/lib/schemas";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** "2026-03-04" -> "Mar 4, 2026" without timezone drift. */
export function formatDate(iso: string | null | undefined, opts: { short?: boolean } = {}) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", ...(opts.short ? {} : { year: "numeric" }), timeZone: "UTC",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const CATEGORY_META: Record<FindingCategory, { label: string; short: string; tone: Tone; description: string }> = {
  confirmed_incomplete: { label: "Confirmed incomplete", short: "Confirmed", tone: "red", description: "Evidence directly establishes the work is incomplete." },
  potentially_incomplete: { label: "Potentially incomplete", short: "Potential", tone: "amber", description: "Evidence suggests something may be missing; needs verification." },
  unverified: { label: "Unverified", short: "Unverified", tone: "slate", description: "The records don't establish whether the work was done." },
  conflicting: { label: "Conflicting information", short: "Conflict", tone: "violet", description: "Two or more sources are inconsistent." },
};

export const GAP_LABEL: Record<GapType, string> = {
  missing_document: "Missing document",
  missing_request: "No request on file",
  unverified_outcome: "Outcome unverified",
  conflicting_records: "Records conflict",
  other: "Other",
};

export type Tone = "red" | "amber" | "slate" | "violet" | "green" | "neutral" | "accent";

const TONE: Record<Tone, string> = {
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  slate: "bg-slate-soft text-slate",
  violet: "bg-violet-soft text-violet",
  green: "bg-green-soft text-green",
  neutral: "bg-sunken text-ink-2",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-medium leading-4", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  const c: Record<Tone, string> = {
    red: "bg-red", amber: "bg-amber", slate: "bg-slate", violet: "bg-violet", green: "bg-green", neutral: "bg-ink-3", accent: "bg-accent",
  };
  return <span className={cx("inline-block h-2 w-2 shrink-0 rounded-full", c[tone])} />;
}

export function PriorityLabel({ p }: { p: Priority }) {
  const map: Record<Priority, { label: string; cls: string }> = {
    high: { label: "High priority", cls: "text-ink font-semibold" },
    medium: { label: "Medium priority", cls: "text-ink-2 font-medium" },
    low: { label: "Low priority", cls: "text-ink-3" },
  };
  const bars = p === "high" ? 3 : p === "medium" ? 2 : 1;
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[12px]", map[p].cls)}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx("w-[3px] rounded-sm", i <= bars ? "bg-ink-2" : "bg-line-strong")} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      {map[p].label}
    </span>
  );
}

export function SectionHeading({ id, title, count, children }: { id: string; title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-6 items-end justify-between gap-4 border-b border-line pb-3">
      <h2 className="text-[19px] font-semibold tracking-tight">
        {title}
        {count !== undefined && <span className="ml-2 text-[15px] font-normal text-ink-3 tabular">{count}</span>}
      </h2>
      {children}
    </div>
  );
}
