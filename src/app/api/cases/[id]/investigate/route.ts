import { investigate } from "@/lib/agent/engine";
import type { InvestigationEvent } from "@/lib/agent/types";
import { getProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** Streams investigation progress as newline-delimited JSON events. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        await investigate({ caseId: id, provider: getProvider(), onEvent: send });
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
