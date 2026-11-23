import { getCase, readDocumentBytes } from "@/lib/store";

export const runtime = "nodejs";

/** Serves the original, unmodified source file. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const c = await getCase(id);
  const doc = c?.documents.find((d) => d.id === docId);
  if (!doc) return new Response("Not found", { status: 404 });
  const bytes = await readDocumentBytes(id, doc);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.kind === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
    },
  });
}
