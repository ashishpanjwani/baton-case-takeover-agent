/**
 * Generates a fictional *scanned* PDF (image only, no text layer) for testing OCR.
 * It is not part of the seeded case file: upload it from the case page to see
 * OCR in action. Run with: npm run seed:scanned
 */
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../seed/samples/scanned-pt-intake-fax.pdf");

const PAGES: string[][] = [
  [
    "[FICTIONAL DEMO RECORD - NOT A REAL CLIENT]",
    "FAX - Brightline Physical Therapy (fictional)",
    "To: Calder & Wynn Injury Law   Date sent: 10/02/2026",
    "",
    "PHYSICAL THERAPY INITIAL EVALUATION",
    "Patient: Sarah Johnson   DOB: 04/11/1988",
    "Date of evaluation: 08/19/2026",
    "Referred by: Dr. Alan Pierce, orthopedics",
    "",
    "Chief complaint: neck pain and stiffness since a motor",
    "vehicle collision on 03/04/2026. Pain 6/10 at rest.",
    "",
    "Plan: 2 visits per week for 8 weeks. Re-evaluate on",
    "10/14/2026. Home exercise program provided.",
  ],
  [
    "[FICTIONAL DEMO RECORD - NOT A REAL CLIENT]",
    "Brightline Physical Therapy - visit log (page 2)",
    "",
    "08/19/2026  Initial evaluation completed",
    "08/26/2026  Visit 2 - manual therapy, exercises",
    "09/02/2026  Visit 3 - patient reports pain 5/10",
    "09/16/2026  Visit 4 - no-show, rescheduled",
    "",
    "Records requests should be sent to the records",
    "department by fax. Itemized billing is issued",
    "separately by our billing office.",
  ],
];

/** Draw lines as a slightly rotated grey-on-off-white "scan" and return PNG bytes. */
function renderScan(lines: string[]) {
  const W = 1700, H = 2200; // 8.5 x 11 in at 200 dpi
  const c = createCanvas(W, H);
  const g = c.getContext("2d");
  g.fillStyle = "#f7f6f2";
  g.fillRect(0, 0, W, H);
  // Light speckle noise, like a fax.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = "#c9c7c0";
  for (let i = 0; i < 2500; i++) g.fillRect(rand() * W, rand() * H, 2, 2);
  g.translate(W / 2, H / 2);
  g.rotate(0.006);
  g.translate(-W / 2, -H / 2);
  g.fillStyle = "#222";
  g.font = "44px Helvetica, Arial, sans-serif";
  lines.forEach((line, i) => g.fillText(line, 150, 220 + i * 78));
  return c.toBuffer("image/png");
}

const doc = await PDFDocument.create();
doc.setTitle("Scanned fax (fictional)");
for (const lines of PAGES) {
  const img = await doc.embedPng(renderScan(lines));
  const page = doc.addPage([612, 792]);
  page.drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
}
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, await doc.save());
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
