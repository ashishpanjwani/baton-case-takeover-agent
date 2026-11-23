import { describe, expect, it } from "vitest";
import { getDemoReport } from "@/lib/agent/demo-report";
import { stepsFor, suggestedDue, tasksCsv } from "@/lib/integrations";

const ctx = { clientName: "Sarah Johnson", reference: "CW-2026-0187" };
const FRI = new Date(2026, 10, 20); // Friday 11/20/2026
const plan = getDemoReport("cw-2026-0187")!.recoveryPlan;
const byId = (id: string) => plan.find((a) => a.id === id)!;
const systems = (id: string) => stepsFor(byId(id), ctx, byId(id).draft?.body ?? "", FRI).map((s) => s.connection);

describe("carrying out recovery actions", () => {
  it("routes each action to the systems it would use, ending with a CMS task", () => {
    expect(systems("A1")).toEqual(["phone", "cms"]); // call script
    expect(systems("A2")).toEqual(["cms", "cms"]); // record update, then task
    expect(systems("A3")).toEqual(["documents", "cms"]); // find files in the folder
    expect(systems("A5")).toEqual(["email", "cms"]); // adjuster email, not a records request
    expect(systems("A6")).toEqual(["email", "records", "cms"]); // provider records follow-up
    expect(systems("A7")).toEqual(["mail", "records", "cms"]); // records request letter
    for (const a of plan) expect(stepsFor(a, ctx, "", FRI).at(-1)!.connection).toBe("cms");
  });

  it("uses the edited draft text in the downloadable email", () => {
    const a = byId("A5");
    const email = stepsFor(a, ctx, "EDITED BODY", FRI).find((s) => s.connection === "email")!;
    expect(email.file!.filename).toMatch(/\.eml$/);
    expect(email.file!.content).toContain(`To: ${a.draft!.to}`);
    expect(email.file!.content).toContain("X-Unsent: 1");
    expect(email.file!.content).toContain("EDITED BODY");
  });

  it("suggests due dates in business days by priority", () => {
    expect(suggestedDue({ ...byId("A1"), priority: "high" }, FRI)).toBe("2026-11-24");
    expect(suggestedDue({ ...byId("A1"), priority: "medium" }, FRI)).toBe("2026-11-27");
    expect(suggestedDue({ ...byId("A1"), priority: "low" }, FRI)).toBe("2026-12-04");
  });

  it("exports a task CSV with one row per action and quoted multi-line cells", () => {
    const csv = tasksCsv(plan, ctx, FRI);
    expect(csv.split("\r\n")[0]).toMatch(/^Order,Title,Description/);
    expect(csv.match(/CW-2026-0187\)/g)!.length).toBe(plan.length);
    expect(csv).toContain('"Call the client');
  });
});
