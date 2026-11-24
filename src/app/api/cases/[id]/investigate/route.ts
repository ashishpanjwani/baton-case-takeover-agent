import { chunkBudgetMs, investigateStep, type ContinuationToken } from "@/lib/agent/engine";
import type { InvestigationEvent } from "@/lib/agent/types";
import { getProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel's free (Hobby) plan allows at most 300 seconds per request; a larger value fails the deployment.
// On a paid plan this can be raised (e.g. 600), since an investigation can take several minutes.
export const maxDuration = 300;

/**
 * Streams investigation progress as newline-delimited JSON events.
 *
 * Where a host limits how long a request may run (Vercel), the agent pauses between
 * rounds before the limit and the stream ends with a "paused" event carrying a token.
 * The browser then calls again with { continueFrom: token } and the investigation
 * carries on from where it stopped.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let continueFrom: ContinuationToken | null = null;
  try {
    const body = (await req.json()) as { continueFrom?: ContinuationToken };
    continueFrom = body?.continueFrom ?? null;
  } catch {
    // No body: a fresh investigation.
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // If the browser goes away (tab closed, network drop), keep investigating and save
      // the report anyway: stopping halfway would waste the steps already paid for.
      let open = true;
      const send = (e: InvestigationEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        await investigateStep({ caseId: id, provider: getProvider(), onEvent: send, pauseAfterMs: chunkBudgetMs(), continueFrom });
      } catch {
        // "failed" event already emitted by the engine
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
