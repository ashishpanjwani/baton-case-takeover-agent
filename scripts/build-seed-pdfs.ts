/**
 * Generates the synthetic PDF documents for the seeded cases.
 * All content is fictional. Run with: npm run seed:pdfs [case-id ...]
 * (no ids = every case; e.g. `npm run seed:pdfs cw-2026-0233` rebuilds one case only)
 *
 * PDFs are generated (rather than hand-made) so that page-level citations
 * can be exercised against real PDF text extraction.
 */
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const CASES_DIR = path.resolve(import.meta.dirname, "../seed/cases");
const ONLY = process.argv.slice(2);
let OUT = "";
/** Points output at a case's documents folder; false if that case wasn't requested. */
function forCase(id: string) {
  OUT = path.join(CASES_DIR, id, "documents");
  return ONLY.length === 0 || ONLY.includes(id);
}
const BANNER = "[FICTIONAL DEMO RECORD — NOT A REAL CLIENT]";

type Line = string | { text: string; bold?: boolean; size?: number };
type Page = Line[];

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (text === "") return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function build(filename: string, header: string, pages: Page[]) {
  const doc = await PDFDocument.create();
  doc.setTitle(header);
  doc.setProducer("Case Takeover Agent demo seed");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 56;

  pages.forEach((lines, i) => {
    const page = doc.addPage([612, 792]);
    const width = page.getWidth() - margin * 2;
    let y = page.getHeight() - margin;
    page.drawText(header, { x: margin, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: page.getWidth() - margin - 60, y, size: 8, font, color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;
    page.drawText(BANNER, { x: margin, y, size: 8, font: bold, color: rgb(0.6, 0.1, 0.1) });
    y -= 24;
    for (const raw of lines) {
      const l = typeof raw === "string" ? { text: raw } : raw;
      const f = l.bold ? bold : font;
      const size = l.size ?? 10;
      for (const seg of wrap(l.text, f, size, width)) {
        page.drawText(seg, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= size + 5;
      }
    }
  });
  const bytes = await doc.save();
  await writeFile(path.join(OUT, filename), bytes);
  console.log(`wrote ${filename} (${pages.length} pages)`);
}

const H = (t: string) => ({ text: t, bold: true, size: 12 });
const B = (t: string) => ({ text: t, bold: true });

async function sarahJohnson() {
  await build("02-police-crash-report.pdf", "Harborview Police Department — Traffic Crash Report HPD-26-031187", [
    [
      H("HARBORVIEW POLICE DEPARTMENT — TRAFFIC CRASH REPORT"),
      "Report no.: HPD-26-031187",
      "Date/time of crash: 03/04/2026 17:42",
      "Location: Lakeview Ave at 9th St, Harborview",
      "Weather: Clear. Road surface: Dry. Lighting: Daylight.",
      "Reporting officer: Ptl. J. Alvarez, Badge 2214",
      "",
      B("UNIT 1"),
      "Driver: Kevin R. Marsh",
      "Vehicle: 2017 Ford F-150 (pickup)",
      "Insurance: Granite Mutual Insurance Co., policy GMA-4471209",
      "Damage: Front bumper, grille",
      "",
      B("UNIT 2"),
      "Driver: Sarah M. Johnson",
      "Vehicle: 2019 Honda Civic",
      "Insurance: Lakeshore Auto Insurance, policy LAK-883016",
      "Damage: Rear bumper, trunk lid. Vehicle towed from scene.",
    ],
    [
      B("NARRATIVE"),
      "Unit 2 was stopped westbound on Lakeview Ave for a red signal at 9th St. Unit 1 was traveling westbound behind Unit 2 and failed to stop, striking the rear of Unit 2.",
      "Driver of Unit 1 stated he looked down for a second and did not see that traffic had stopped.",
      "Driver of Unit 1 was cited for failure to maintain an assured clear distance.",
      "",
      B("INJURIES"),
      "Unit 2 driver complained of neck and lower back pain. Transported by Harborview Fire Rescue Medic 7 to St. Brendan Regional Medical Center.",
      "Unit 1 driver: no injury reported.",
      "",
      B("WITNESSES"),
      "None listed.",
      "",
      "Report approved: Sgt. L. Moreno, 03/06/2026",
    ],
  ]);

  await build("06-st-brendan-er-records.pdf", "St. Brendan Regional Medical Center — Emergency Department Record", [
    [
      H("ST. BRENDAN REGIONAL MEDICAL CENTER — EMERGENCY DEPARTMENT RECORD"),
      "Patient: Johnson, Sarah M.   DOB: 06/14/1987   MRN: SB-00418823",
      "Date of service: 03/04/2026",
      "Arrival: 18:21 via EMS (Harborview Fire Rescue, Medic 7)",
      "",
      B("TRIAGE"),
      "Chief complaint: Neck pain, low back pain, left shoulder pain after motor vehicle collision.",
      "Pain score: 7/10. Vital signs stable.",
      "",
      B("HISTORY OF PRESENT ILLNESS"),
      "38-year-old female, restrained driver, rear-ended while stopped at a red light at approximately 17:40. Airbags did not deploy. No loss of consciousness. Reports immediate neck stiffness and left shoulder pain; low back pain began within the hour.",
    ],
    [
      B("EXAMINATION"),
      "Cervical paraspinal tenderness, no midline tenderness. Lumbar paraspinal tenderness. Left shoulder: tenderness over anterior shoulder, pain with abduction above 90 degrees. Neurovascularly intact.",
      "",
      B("IMAGING"),
      "XR cervical spine, 3 views: no acute fracture or malalignment.",
      "XR left shoulder, 2 views: no fracture or dislocation.",
      "Preliminary interpretation by ED physician. Final radiology interpretation by Lakeside Radiology Group.",
      "",
      B("DIAGNOSES"),
      "1. Strain of neck muscle (cervical strain)",
      "2. Strain of lower back (lumbar strain)",
      "3. Contusion of left shoulder",
    ],
    [
      B("TREATMENT IN ED"),
      "Ibuprofen 600 mg PO. Cyclobenzaprine 5 mg PO. Soft cervical collar provided.",
      "",
      B("DISPOSITION"),
      "Discharged home at 22:05 in stable condition.",
      "",
      B("DISCHARGE INSTRUCTIONS"),
      "Follow up with orthopedics within 1 week for left shoulder (referral: Harborview Orthopedic Associates). Return to the ED for numbness, weakness or worsening pain.",
      "",
      "Attending physician: Dr. Paul Engstrom, MD",
      "",
      B("HEALTH INFORMATION MANAGEMENT — RELEASE CERTIFICATION"),
      "Certified copy of the complete emergency department record for date of service 03/04/2026 (3 pages) released to Calder & Wynn Injury Law on 04/24/2026.",
    ],
  ]);

  await build("07-medical-bills.pdf", "Medical Bills — St. Brendan Regional Medical Center; Harborview Fire Rescue", [
    [
      H("ST. BRENDAN REGIONAL MEDICAL CENTER — ITEMIZED STATEMENT"),
      "Patient: Johnson, Sarah M.   Account no.: SB-A-7720914",
      "Statement date: 04/22/2026   Date of service: 03/04/2026",
      "",
      B("CHARGES"),
      "Emergency department visit, level 4 (facility) — $2,140.00",
      "Emergency physician professional services — $780.00",
      "XR cervical spine, 3 views (technical) — $612.00",
      "XR left shoulder, 2 views (technical) — $498.00",
      "Pharmacy — ED medications — $86.00",
      "Supplies — soft cervical collar — $146.00",
      "",
      "Total charges: $4,262.00",
      "Payments and adjustments: $0.00",
      "Balance due: $4,262.00",
    ],
    [
      B("STATEMENT NOTES"),
      "Radiology interpretation (professional component) is billed separately by Lakeside Radiology Group. Charges shown on this statement are facility and emergency physician charges only.",
      "",
      "Questions about this statement: St. Brendan Patient Financial Services, (216) 555-0121.",
    ],
    [
      H("HARBORVIEW FIRE RESCUE — EMS BILLING STATEMENT"),
      "Patient: Sarah M. Johnson   Incident date: 03/04/2026   Unit: Medic 7",
      "Statement date: 04/27/2026   Run no.: HFR-26-11873",
      "",
      "BLS emergency transport — $1,050.00",
      "Mileage, 4.0 miles at $47.50 per mile — $190.00",
      "",
      "Total charges: $1,240.00",
      "Payments: $0.00",
      "Balance due: $1,240.00",
    ],
  ]);

  await build("09-harborview-ortho-response-and-records.pdf", "Harborview Orthopedic Associates — Records Response", [
    [
      H("HARBORVIEW ORTHOPEDIC ASSOCIATES — RELEASE OF INFORMATION"),
      "RECEIVED BY FAX 06/03/2026 — CALDER & WYNN INJURY LAW",
      "",
      "June 1, 2026",
      "To: Dana Whitfield, Calder & Wynn Injury Law",
      "Re: Records request received 05/12/2026 — Patient: Sarah M. Johnson, DOB 06/14/1987",
      "",
      "Enclosed are office visit notes for dates of service 03/18/2026 and 04/08/2026 (2 pages).",
      "",
      "The following items are not included with this release:",
      "1. The office note for date of service 04/29/2026 had not been finalized by the treating provider at the time of processing. It will be released once it has been signed.",
      "2. Itemized billing statements are maintained by our billing office and must be requested directly from Harborview Orthopedic Billing at billing@harborview-ortho.example.",
      "",
      "A copy fee of $28.50 applies to this release (invoice HOA-ROI-55102).",
      "",
      "Release of Information Department, Harborview Orthopedic Associates",
    ],
    [
      H("OFFICE VISIT — 03/18/2026"),
      "Patient: Sarah M. Johnson   Provider: Renee Calloway, MD",
      "New patient. Referred by St. Brendan ED following motor vehicle collision on 03/04/2026.",
      "Subjective: Left shoulder pain, worse with overhead reaching. Neck pain, being treated by chiropractor.",
      "Exam: Reduced active range of motion of left shoulder. Positive impingement signs.",
      "Assessment: Left shoulder pain following MVC; rule out rotator cuff injury.",
      "Plan: MRI of left shoulder ordered at ClearView Imaging Center. Continue chiropractic care for neck and back per patient. Follow up after MRI.",
    ],
    [
      H("OFFICE VISIT — 04/08/2026"),
      "Patient: Sarah M. Johnson   Provider: Renee Calloway, MD",
      "MRI left shoulder performed 04/02/2026 at ClearView Imaging Center shows a partial-thickness tear of the supraspinatus tendon (per imaging report).",
      "Assessment: Partial-thickness supraspinatus tear, left shoulder.",
      "Plan: Physical therapy, referral to Bayside Physical Therapy, 2x/week for 6 weeks. Consider subacromial injection if not improved. Return visit in 3 weeks.",
    ],
  ]);
}

/** CW-2025-0911 — a clean, well-documented file (tests that the agent doesn't invent problems). */
async function aishaThompson() {
  await build("02-police-crash-report.pdf", "Harborview Police Department — Traffic Crash Report HPD-25-044902", [
    [
      H("HARBORVIEW POLICE DEPARTMENT — TRAFFIC CRASH REPORT"),
      "Report no.: HPD-25-044902",
      "Date/time of crash: 09/03/2025 08:15",
      "Location: Bayshore Blvd at Grant St, Harborview (signalized intersection)",
      "Weather: Clear. Road surface: Dry. Lighting: Daylight.",
      "Reporting officer: Ptl. M. Okafor, Badge 1987",
      "Report approved: 09/04/2025",
      "",
      B("UNIT 1"),
      "Driver: Daniel P. Ortega",
      "Vehicle: 2018 Nissan Altima",
      "Insurance: Pinecrest Casualty Company, policy PCA-2290417",
      "Direction: Eastbound on Bayshore Blvd",
      "Damage: Front end",
      "",
      B("UNIT 2"),
      "Driver: Aisha N. Thompson",
      "Vehicle: 2021 Toyota RAV4",
      "Insurance: Summit Auto Insurance, policy SAI-552901",
      "Direction: Northbound on Grant St",
      "Damage: Front passenger side door and fender",
    ],
    [
      B("NARRATIVE"),
      "Unit 2 was northbound on Grant St and entered the intersection on a green signal. Unit 1 was eastbound on Bayshore Blvd and entered the intersection against a steady red signal, striking the front passenger side of Unit 2.",
      "",
      B("WITNESS"),
      "Grace Liu, pedestrian at the northeast corner, stated that Unit 1 entered the intersection on red. Contact information on file with HPD.",
      "",
      B("INJURIES"),
      "Driver of Unit 2 complained of neck and right shoulder pain. Declined EMS transport. No injuries reported for Unit 1.",
      "",
      B("CITATIONS"),
      "Unit 1 driver cited: Failure to obey traffic control device. Citation no. HC-25-77120.",
    ],
  ]);

  await build("06-medical-records-excerpts.pdf", "Medical Records Excerpts — Thompson, Aisha N. (DOB 02/27/1991)", [
    [
      H("MERCY COAST HOSPITAL — EMERGENCY DEPARTMENT"),
      "Patient: Aisha N. Thompson    DOB: 02/27/1991",
      "Arrival: 09/03/2025 09:02    Discharge: 09/03/2025 11:40",
      "Attending: Monica Ruiz, MD (Coastal Emergency Physicians)",
      "",
      B("Chief complaint"),
      "Neck pain and right shoulder pain after a motor vehicle collision this morning. Restrained driver; side impact.",
      B("Imaging"),
      "X-ray cervical spine: No fracture or malalignment.",
      "X-ray right shoulder: No fracture or dislocation.",
      B("Diagnoses"),
      "Cervical strain. Right shoulder strain. Contusion of right knee.",
      B("Disposition"),
      "Discharged home. Ibuprofen as needed. Follow up with primary care within 1 week.",
    ],
    [
      H("COASTLINE PHYSICAL THERAPY — DISCHARGE SUMMARY"),
      "Patient: Aisha N. Thompson    DOB: 02/27/1991",
      "Referring provider: Helen Park, MD (Grant Street Family Medicine)",
      "Dates of care: 09/15/2025 to 12/19/2025    Total visits: 28",
      "",
      B("Diagnoses treated"),
      "Cervical strain; right shoulder strain.",
      B("Outcome"),
      "Cervical range of motion full and pain-free. Right shoulder strength 5/5 with mild discomfort on repeated overhead lifting.",
      "All short- and long-term goals met.",
      B("Discharge plan"),
      "Discharged to a home exercise program on 12/19/2025.",
      "Therapist: Jordan Lee, DPT",
    ],
    [
      H("BAYVIEW ORTHOPEDICS — OFFICE NOTE"),
      "Patient: Aisha N. Thompson    DOB: 02/27/1991",
      "Date of service: 02/17/2026    Provider: Samuel Reyes, MD",
      "",
      B("History"),
      "Right shoulder pain after a motor vehicle collision on 09/03/2025. MRI right shoulder on 11/10/2025 at Harbor Imaging Associates showed supraspinatus tendinosis without a tear. Subacromial injection on 01/13/2026 gave good relief.",
      B("Exam"),
      "Full active range of motion of the right shoulder. Strength 5/5. Minimal tenderness.",
      B("Assessment"),
      "Right shoulder strain with supraspinatus tendinosis, resolved.",
      B("Plan"),
      "Patient has reached maximum medical improvement. Released from care. No surgery recommended. Return as needed for flare-ups.",
    ],
  ]);
}

/** CW-2026-0233 — a messy file with problems unlike the Johnson case. */
async function robertKim() {
  await build("02-animal-services-report.pdf", "Harborview Animal Services — Bite Report AS-26-04417", [
    [
      H("HARBORVIEW ANIMAL SERVICES — ANIMAL BITE REPORT"),
      "Report no.: AS-26-04417",
      "Report taken: 09/14/2026 10:05 (by phone from victim)",
      "Officer: K. Duarte",
      "",
      B("INCIDENT"),
      "Date/time of bite: 09/12/2026, approx. 18:40",
      "Location: Public sidewalk in front of 1427 Alder Lane, Harborview",
      "",
      B("VICTIM"),
      "Robert J. Kim, 1510 Alder Lane, (216) 555-0188",
      "Injury: Bite to left forearm. Victim reports treatment at an urgent care.",
      "",
      B("ANIMAL"),
      "Name: Bruno. Dog, mixed breed, brown, approx. 50 lb.",
      "Owner: Trevor Banks, 1427 Alder Lane (tenant)",
      "Rabies vaccination: Owner states current. Proof of vaccination requested by 09/21/2026.",
    ],
    [
      B("NARRATIVE"),
      "Victim states he was walking on the sidewalk when the dog ran out through an open side gate and bit his left forearm. Owner came out and restrained the dog. Owner confirms the gate had been left open.",
      "",
      B("WITNESS"),
      "Lisa Moreno, 1431 Alder Lane, (216) 555-0177. States she saw the dog leave the yard and bite the victim.",
      "",
      B("ACTION TAKEN"),
      "10-day home observation (quarantine) ordered, ending 09/22/2026. Owner instructed to keep the dog confined and report any illness. Observation outcome to be recorded on release.",
      "Owner advised of leash and confinement requirements.",
    ],
  ]);

  await build("04-quickmed-urgent-care-record.pdf", "QuickMed Express Urgent Care — Alder Plaza — Visit Record", [
    [
      H("QUICKMED EXPRESS URGENT CARE — ALDER PLAZA"),
      "Patient: Robert J. Kim    DOB: 06/03/1994",
      "Date of visit: 09/13/2026    Check-in: 09:20",
      "Provider: Kevin Tran, PA-C",
      "Copy provided to patient at discharge.",
      "",
      B("Chief complaint"),
      "Dog bite to left forearm yesterday evening (09/12) by neighbor's dog. Owner known.",
      B("Exam"),
      "Left volar forearm: 3 cm laceration and two puncture wounds, no active bleeding. Abrasions to the dorsum of the left hand. Full range of motion. No signs of infection.",
      B("Treatment"),
      "Wounds irrigated. Laceration closed with wound closure strips (not sutured because of infection risk). Tdap given. Amoxicillin-clavulanate for 7 days.",
    ],
    [
      B("Rabies"),
      "Dog reportedly vaccinated and available for observation. Rabies post-exposure prophylaxis deferred. Patient to return immediately if animal control reports the dog becomes ill or cannot be observed.",
      B("Follow-up"),
      "Wound check in 3 days (09/16/2026) here or with a primary care provider.",
      B("Diagnoses"),
      "Dog bite of left forearm. Laceration of left forearm. Abrasion of left hand.",
    ],
  ]);
}

/** Draws lines as a slightly skewed, speckled fax page and returns PNG bytes. */
function renderScan(lines: string[], seedNo: number) {
  const W = 1700, H = 2200; // 8.5 x 11 in at 200 dpi
  const c = createCanvas(W, H);
  const g = c.getContext("2d");
  g.fillStyle = "#f7f6f2";
  g.fillRect(0, 0, W, H);
  let seed = seedNo;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = "#c9c7c0";
  for (let i = 0; i < 2500; i++) g.fillRect(rand() * W, rand() * H, 2, 2);
  g.translate(W / 2, H / 2);
  g.rotate(0.005);
  g.translate(-W / 2, -H / 2);
  g.fillStyle = "#222";
  g.font = "40px Helvetica, Arial, sans-serif";
  lines.forEach((line, i) => g.fillText(line, 140, 200 + i * 70));
  return c.toBuffer("image/png");
}

/** An image-only PDF (no text layer), like a faxed record. Read by OCR. */
async function buildScan(filename: string, title: string, pages: string[][]) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer("Case Takeover Agent demo seed");
  for (const [i, lines] of pages.entries()) {
    const img = await doc.embedPng(renderScan(lines, 11 + i));
    doc.addPage([612, 792]).drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
  }
  await writeFile(path.join(OUT, filename), await doc.save());
  console.log(`wrote ${path.relative(process.cwd(), path.join(OUT, filename))} (scanned, ${pages.length} pages)`);
}

async function jamesWhitaker() {
  await build("02-police-crash-report.pdf", "Harborview Police Department — Traffic Crash Report HPD-26-118842", [
    [
      H("HARBORVIEW POLICE DEPARTMENT — TRAFFIC CRASH REPORT"),
      "Report no.: HPD-26-118842",
      "Date/time of crash: 08/21/2026, 07:12",
      "Location: Route 14 eastbound, near mile marker 22, Harborview",
      "Reporting officer: Ofc. M. Lindqvist, badge 2207",
      "Weather: Clear. Road: Dry.",
      "",
      B("UNIT 1"),
      "Driver: James R. Whitaker, DOB 02/19/1979, 77 Linden Court, Harborview",
      "Vehicle: 2023 Ford Transit cargo van. Owner: Harbor Produce Co.",
      "Insurance: Shoreline Fleet Insurance, policy SF-55812 (employer's policy)",
      "Lane: Right lane. Damage: Left side, heavy. Driver transported by Harborview Fire Rescue to St. Brendan Medical Center.",
      "",
      B("UNIT 2"),
      "Driver: Carl Dempsey. Commercial driver's license, class A.",
      "Vehicle: 2021 Freightliner Cascadia tractor with 53 ft van trailer",
      "Motor carrier: Ridgeline Freight LLC, USDOT 3398012",
      "Carrier address (from cab paperwork): 210 Commerce Drive, Brookfield",
      "Trailer marking: Summit Logistics",
      "Insurance: Driver could not produce proof of insurance at scene. Carrier to provide.",
      "Lane: Center lane, moving to right lane. Damage: Trailer right side, minor.",
    ],
    [
      B("NARRATIVE"),
      "Unit 2 was traveling east in the center lane and moved into the right lane, striking the left side of Unit 1. Unit 1 was pushed into the right guardrail. Driver of Unit 2 stated he checked his mirror and did not see Unit 1.",
      "",
      B("WITNESS"),
      "Hector Ruiz, (216) 555-0131. Was driving behind Unit 1. States Unit 2 moved into the right lane without signaling.",
      "",
      B("CITATIONS"),
      "Unit 2 driver cited: Improper lane change.",
      "",
      B("OTHER"),
      "No impairment suspected for either driver. Hours of service not reviewed at scene.",
      "Photos taken by the officer: 14.",
    ],
  ]);

  await buildScan("05-st-brendan-ed-records-fax.pdf", "St. Brendan ED records (fax)", [
    [
      "[FICTIONAL DEMO RECORD - NOT A REAL CLIENT]",
      "FAX - St. Brendan Medical Center, Health Information",
      "To: Calder & Wynn Injury Law     Sent: 09/15/2026",
      "",
      "EMERGENCY DEPARTMENT RECORD",
      "Patient: James R. Whitaker     DOB: 02/19/1979",
      "Arrival: 08/21/2026 07:58 by ambulance",
      "Attending: Dr. Samuel Okoro",
      "",
      "History: Restrained driver of a van struck on the",
      "driver side by a tractor-trailer. Complains of right",
      "wrist pain, low back pain, left shoulder pain.",
      "",
      "Imaging: X-ray right wrist shows a nondisplaced",
      "fracture of the distal radius. X-ray lumbar spine:",
      "no fracture. CT head: no acute findings.",
      "",
      "Treatment: Right wrist placed in a splint.",
      "Pain medication given. Discharged 12:40.",
    ],
    [
      "[FICTIONAL DEMO RECORD - NOT A REAL CLIENT]",
      "St. Brendan ED record - page 2",
      "",
      "Diagnoses:",
      "1. Fracture of right distal radius, closed",
      "2. Lumbar strain",
      "3. Contusion of left shoulder",
      "",
      "Instructions: Follow up with orthopedics within",
      "one week. Return if numbness or weakness in the",
      "legs. Off work until seen by orthopedics.",
      "",
      "Billing for this visit is issued separately by",
      "the patient accounts office.",
    ],
  ]);

  await build("06-lakeview-spine-consult.pdf", "Lakeview Spine & Orthopedics — Consultation 10/06/2026", [
    [
      H("LAKEVIEW SPINE & ORTHOPEDICS — CONSULTATION"),
      "Patient: James R. Whitaker    DOB: 02/19/1979",
      "Date of visit: 10/06/2026",
      "Provider: Nadia Brooks, MD",
      "Workers' compensation claim: TC-26-30981",
      "",
      B("History"),
      "Seen 09/14/2026 for right wrist fracture and low back pain after a work-related truck collision on 08/21/2026. Back pain now radiates to the left leg with numbness in the left foot. PT for the wrist started 09/28/2026.",
      "",
      B("MRI lumbar spine, 09/29/2026"),
      "L4-5 left paracentral disc herniation with compression of the left L5 nerve root. Mild degenerative change at L5-S1.",
      "",
      B("Wrist"),
      "Distal radius fracture healing. Cast removed 10/06/2026. Continue PT.",
    ],
    [
      B("Assessment"),
      "1. L4-5 disc herniation with left L5 radiculopathy, related to the collision of 08/21/2026 by history.",
      "2. Right distal radius fracture, healing.",
      "",
      B("Plan"),
      "Recommend left L4-5 microdiscectomy. Six weeks of conservative care have not helped. Authorization request to be sent to the workers' compensation carrier.",
      "Remain off work. Re-check in 4 weeks or after surgery.",
    ],
  ]);
}

async function main() {
  if (forCase("cw-2026-0187")) await sarahJohnson();
  if (forCase("cw-2025-0911")) await aishaThompson();
  if (forCase("cw-2026-0233")) await robertKim();
  if (forCase("cw-2026-0198")) await jamesWhitaker();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
