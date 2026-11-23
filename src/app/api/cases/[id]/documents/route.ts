import { NextResponse } from "next/server";
import { extractDocument, isSupported, SUPPORTED_EXTENSIONS } from "@/lib/extract";
import { addUpload, getCase } from "@/lib/store";

export const runtime = "nodejs";
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCase(id))) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!isSupported(file.name))
    return NextResponse.json({ error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}` }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 15 MB" }, { status: 400 });

  const doc = await addUpload(id, {
    filename: file.name,
    bytes: Buffer.from(await file.arrayBuffer()),
    title: String(form.get("title") ?? ""),
    category: String(form.get("category") ?? ""),
  });
  try {
    const x = await extractDocument(id, doc);
    return NextResponse.json({ document: doc, pages: x.pages.length, chars: x.charCount, ocrPages: x.ocrPages.length, emptyPages: x.emptyPages.length });
  } catch (e) {
    return NextResponse.json({ document: doc, pages: 0, chars: 0, warning: `Saved, but text extraction failed: ${e instanceof Error ? e.message : e}` });
  }
}
