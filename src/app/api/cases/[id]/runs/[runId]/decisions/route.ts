import { NextResponse } from "next/server";
import { z } from "zod";
import { getRun, setDecision } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.object({
  actionId: z.string(),
  status: z.enum(["approved", "dismissed"]).nullable(),
  note: z.string().nullable().optional(),
  editedDraftBody: z.string().nullable().optional(),
});

/**
 * Records an approve/dismiss decision on a proposed action.
 * This only stores the decision locally. It never sends anything or modifies a CMS.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const run = await getRun(id, runId);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { actionId, status, note, editedDraftBody } = parsed.data;
  if (!run.report.recoveryPlan.some((a) => a.id === actionId)) return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  const decision = status ? { status, note: note ?? null, editedDraftBody: editedDraftBody ?? null, decidedAt: new Date().toISOString() } : null;
  await setDecision(id, runId, actionId, decision);
  return NextResponse.json({ decision });
}
