import { NextResponse } from "next/server";
import { extractDocument } from "@/lib/extract";
import { getCase } from "@/lib/store";

export const runtime = "nodejs";

/** Returns a document's metadata and extracted text (per page). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const c = await getCase(id);
  const doc = c?.documents.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const x = await extractDocument(id, doc);
  return NextResponse.json({ document: doc, pages: x.pages, ocrPages: x.ocrPages, emptyPages: x.emptyPages });
}
