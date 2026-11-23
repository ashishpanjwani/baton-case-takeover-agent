/**
 * Prints the estimated API spend recorded per investigation run, failed runs
 * included. Cost is deliberately kept out of the app's UI; this is for whoever
 * pays for the API key. Run: npm run spend
 *
 * Estimates use list prices. A call cut off mid-response (network drop, laptop
 * asleep) is billed for what it generated but reports no usage, so the Claude
 * Console's Usage page remains the source of truth.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve("data");
type Entry = {
  at: string; runId: string | null; status: string; error: string | null;
  estimatedCostUsd: number | null; calls: { role: string; model: string }[];
};

const rows: (Entry & { caseId: string })[] = [];
for (const caseId of await readdir(path.join(DATA, "cases")).catch(() => [] as string[])) {
  const text = await readFile(path.join(DATA, "cases", caseId, "spend.jsonl"), "utf8").catch(() => "");
  for (const line of text.split("\n")) if (line.trim()) rows.push({ ...JSON.parse(line), caseId });
}
if (!rows.length) {
  console.log("No API spend recorded yet. (Runs from before this log existed are not included.)");
  process.exit(0);
}
rows.sort((a, b) => a.at.localeCompare(b.at));
let total = 0;
for (const r of rows) {
  const models = [...new Set(r.calls.map((c) => c.model))].join(", ") || "-";
  const cost = r.estimatedCostUsd ?? 0;
  total += cost;
  console.log(
    `${r.at.slice(0, 16).replace("T", " ")}  ${r.caseId.padEnd(14)} ${r.status.padEnd(9)} ${String(r.calls.length).padStart(3)} calls  $${cost.toFixed(3).padStart(6)}  ${models}` +
      (r.error ? `\n${" ".repeat(18)}error: ${r.error.slice(0, 110)}` : ""),
  );
}
console.log(`\nTotal recorded: $${total.toFixed(2)} over ${rows.length} run(s). The Claude Console Usage page has exact billing.`);
