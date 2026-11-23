/**
 * PRECOMPUTED DEMO ANALYSIS — not produced by an AI model.
 *
 * This is a hand-authored reference report for the seeded case (CW-2026-0187),
 * used only when no LLM credentials are configured. It goes through the same
 * schema validation and citation verification as model output, and the UI
 * labels it as demo output. It also doubles as a reference answer for
 * evaluating the AI pipeline on this case.
 */
import type { Evidence, TakeoverReport } from "../schemas";

const ev = (docId: string, quote: string, note: string | null = null): Evidence => ({ docId, quote, page: null, note });

const report: TakeoverReport = {
  overview: {
    caseType: "Motor vehicle accident — rear-end collision",
    currentStage: "Pre-litigation — records and bills collection",
    summary:
      "Sarah Johnson's vehicle was struck from behind while she was stopped at a red light on 03/04/2026. She was taken by ambulance to St. Brendan ER, then treated with chiropractic care and orthopedics for her left shoulder, where an MRI showed a partial-thickness supraspinatus tear. She has also reported physical therapy and one urgent care visit. Records and bills are in the file for the ER and ambulance. Orthopedic records are partial. No records from the chiropractor, MRI facility, PT, urgent care or radiology group are in the review package. MedPay ($5,000) has been paid and exhausted. The CMS records liability as accepted and BI limits as $50k/$100k, but the adjuster's later email says both are still open. The last client contact was a voicemail on 09/22/2026, with no callback recorded.",
    keyEvents: [
      { date: "2026-03-04", description: "Rear-end collision at Lakeview Ave and 9th St; client transported to St. Brendan ER by ambulance.", evidence: [ev("doc-02", "Unit 1 was traveling westbound behind Unit 2 and failed to stop, striking the rear of Unit 2.")] },
      { date: "2026-04-08", description: "Orthopedist reviews MRI (partial-thickness supraspinatus tear) and refers client to physical therapy.", evidence: [ev("doc-09", "shows a partial-thickness tear of the supraspinatus tendon")] },
      { date: "2026-06-18", description: "Lakeshore pays MedPay; the $5,000 limit is exhausted.", evidence: [ev("doc-13", "This exhausts the $5,000.00 Medical Payments limit on this claim.")] },
      { date: "2026-08-19", description: "Granite Mutual adjuster writes that the policy limits request is with underwriting and that the liability investigation remains open.", evidence: [ev("doc-13", "please note that our liability investigation remains open")] },
      { date: "2026-09-22", description: "Client leaves a voicemail asking for an update. No callback is recorded.", evidence: [ev("doc-10", "VM from client asking for an update on her case and whether she needs to send us anything. Callback needed.")] },
      { date: "2026-10-31", description: "Case reassigned after the previous case manager's departure on 10/24/2026.", evidence: [ev("doc-15", "Dana Whitfield's last day was 10/24/2026.")] },
    ],
    providers: [
      { name: "Harborview Fire Rescue (Medic 7)", role: "Ambulance", datesOfService: "03/04/2026", recordsStatus: "Not applicable (per provider list)", billsStatus: "Received — in file ($1,240.00)", evidence: [ev("doc-07", "Total charges: $1,240.00")] },
      { name: "St. Brendan Regional Medical Center", role: "Emergency department", datesOfService: "03/04/2026", recordsStatus: "Received — in file, certified complete (3 pages)", billsStatus: "Received — in file ($4,262.00, facility and ED physician only)", evidence: [ev("doc-06", "Certified copy of the complete emergency department record for date of service 03/04/2026 (3 pages)"), ev("doc-07", "Total charges: $4,262.00")] },
      { name: "Lakeside Radiology Group", role: "Radiology interpretation (ER X-rays)", datesOfService: "03/04/2026", recordsStatus: "Not in file", billsStatus: "Billed separately — not in file; no request found", evidence: [ev("doc-07", "Radiology interpretation (professional component) is billed separately by Lakeside Radiology Group.")] },
      { name: "Northgate Spine & Chiropractic (Dr. Alan Pierce, DC)", role: "Chiropractic", datesOfService: "03/10/2026 – 07/24/2026 (client-reported discharge date)", recordsStatus: "Listed in CMS index (DOS 03/10–05/28) — not in review package", billsStatus: "Conflicting — see finding F8", evidence: [ev("doc-10", "Client confirmed she started chiropractic at Northgate Spine & Chiropractic on 03/10/2026."), ev("doc-14", "Northgate Chiro Records DOS 03-10-2026 to 05-28-2026.pdf")] },
      { name: "Harborview Orthopedic Associates (Dr. Renee Calloway)", role: "Orthopedics — left shoulder", datesOfService: "03/18/2026 – ongoing (visits on 04/08, 04/29 and 08/10 are documented)", recordsStatus: "Partial — 03/18 and 04/08 in file", billsStatus: "Not received — requested again 09/10", evidence: [ev("doc-09", "Enclosed are office visit notes for dates of service 03/18/2026 and 04/08/2026 (2 pages).")] },
      { name: "ClearView Imaging Center", role: "MRI, left shoulder", datesOfService: "04/02/2026", recordsStatus: "Not in file — not yet requested as of 06/10", billsStatus: "Not in file — not yet requested as of 06/10", evidence: [ev("doc-09", "MRI left shoulder performed 04/02/2026 at ClearView Imaging Center"), ev("doc-05", "Records: Not yet requested")] },
      { name: "Bayside Physical Therapy", role: "Physical therapy", datesOfService: "05/04/2026 – 07/31/2026 (client-reported)", recordsStatus: "Not in file; no request found", billsStatus: "Not in file; no request found", evidence: [ev("doc-09", "referral to Bayside Physical Therapy"), ev("doc-10", "Client started PT at Bayside Physical Therapy on 05/04/2026, 2x/week.")] },
      { name: "QuickCare Urgent Care (Eastside)", role: "Urgent care", datesOfService: "06/14/2026 (client-reported)", recordsStatus: "Not in file; no request found", billsStatus: "Not in file; no request found", evidence: [ev("doc-10", "she went to QuickCare Urgent Care (Eastside) on 06/14/2026")] },
    ],
    insurance: [
      { role: "Adverse carrier (bodily injury)", carrier: "Granite Mutual Insurance Co.", identifiers: "Policy GMA-4471209; claim GM-26-0448812; adjuster Tom Bellamy", details: "Insured driver Kevin R. Marsh. Liability position and BI limits are both unconfirmed. The CMS and the adjuster's 08/19 email conflict (see F6, F7).", evidence: [ev("doc-02", "Insurance: Granite Mutual Insurance Co., policy GMA-4471209"), ev("doc-04", "Claim no.: GM-26-0448812")] },
      { role: "Client's auto carrier (MedPay, UM/UIM)", carrier: "Lakeshore Auto Insurance", identifiers: "Policy LAK-883016; claim LS-7731-26; adjuster Janet Kwan", details: "MedPay of $5,000 per person was paid and is exhausted. The client reports having UM/UIM coverage; the limits have not been confirmed.", evidence: [ev("doc-13", "I can confirm that policy LAK-883016 includes Medical Payments coverage of $5,000 per person."), ev("doc-04", "UM/UIM: Client reports she has UM/UIM coverage. Limits not yet confirmed.")] },
      { role: "Health plan", carrier: "BlueRiver Health Plan", identifiers: "Member ID BRH-20931774 (group: Brightwater Dental Group)", details: "Listed in the insurance summary. The file contains no other information about payments by the health plan.", evidence: [ev("doc-04", "Member ID: BRH-20931774")] },
    ],
    lastMeaningfulActivity: {
      date: "2026-09-15",
      description: "The last firm-initiated activity was a follow-up email to Northgate Chiropractic billing on 09/15/2026. The client then left a voicemail on 09/22/2026, and no callback is recorded. The file shows no activity between 09/22 and the reassignment on 10/31. I couldn't establish whether any work happened outside the CMS in that period.",
      evidence: [
        ev("doc-11", "09/15/2026 DW — Northgate Chiro still has not sent itemized bills. Sent follow-up email to their billing dept."),
        ev("doc-10", "VM from client asking for an update on her case"),
      ],
    },
  },

  timeline: [
    { date: "2026-03-04", category: "incident", description: "Rear-end collision at Lakeview Ave and 9th St. The client's vehicle was stopped at a red light when it was struck.", evidence: [ev("doc-02", "Date/time of crash: 03/04/2026 17:42"), ev("doc-02", "Unit 1 was traveling westbound behind Unit 2 and failed to stop, striking the rear of Unit 2.")], relatedFindingIds: [] },
    { date: "2026-03-04", category: "treatment", description: "Ambulance transport (Harborview Fire Rescue, Medic 7) to St. Brendan ER. X-rays were negative, with diagnoses of cervical strain, lumbar strain and left shoulder contusion. Discharged the same night with an orthopedic referral.", evidence: [ev("doc-06", "Arrival: 18:21 via EMS (Harborview Fire Rescue, Medic 7)"), ev("doc-06", "Discharged home at 22:05 in stable condition."), ev("doc-06", "Follow up with orthopedics within 1 week for left shoulder (referral: Harborview Orthopedic Associates).")], relatedFindingIds: [] },
    { date: "2026-03-06", category: "administrative", description: "Intake completed. Retainer and HIPAA authorizations signed.", evidence: [ev("doc-01", "Retainer agreement and HIPAA authorizations signed 03/06/2026.")], relatedFindingIds: [] },
    { date: "2026-03-09", category: "insurance", description: "Letters of representation sent to Granite Mutual and Lakeshore Auto.", evidence: [ev("doc-11", "03/09/2026 DW — Letters of representation sent to Granite Mutual (BI) and Lakeshore Auto (MedPay) by email and mail.")], relatedFindingIds: [] },
    { date: "2026-03-10", category: "treatment", description: "Client began chiropractic care at Northgate Spine & Chiropractic (client-reported).", evidence: [ev("doc-10", "Client confirmed she started chiropractic at Northgate Spine & Chiropractic on 03/10/2026.")], relatedFindingIds: ["F9"] },
    { date: "2026-03-12", category: "insurance", description: "Granite Mutual acknowledged representation and assigned claim GM-26-0448812. Liability was under investigation.", evidence: [ev("doc-13", "We acknowledge receipt of your letter of representation. This loss has been assigned claim number GM-26-0448812."), ev("doc-13", "Our liability investigation is underway, and we will contact you once a determination has been made.")], relatedFindingIds: ["F6"] },
    { date: "2026-03-16", category: "insurance", description: "Lakeshore confirmed $5,000 MedPay coverage under policy LAK-883016.", evidence: [ev("doc-13", "I can confirm that policy LAK-883016 includes Medical Payments coverage of $5,000 per person.")], relatedFindingIds: [] },
    { date: "2026-03-18", category: "treatment", description: "Initial orthopedic visit with Dr. Calloway. Left shoulder MRI ordered at ClearView Imaging Center.", evidence: [ev("doc-09", "New patient. Referred by St. Brendan ED following motor vehicle collision on 03/04/2026."), ev("doc-09", "MRI of left shoulder ordered at ClearView Imaging Center.")], relatedFindingIds: ["F2"] },
    { date: "2026-03-27", category: "records_and_bills", description: "Police report received (requested 03/20).", evidence: [ev("doc-11", "03/27/2026 DW — Police report received and saved to file.")], relatedFindingIds: [] },
    { date: "2026-04-02", category: "treatment", description: "Left shoulder MRI at ClearView Imaging Center.", evidence: [ev("doc-09", "MRI left shoulder performed 04/02/2026 at ClearView Imaging Center")], relatedFindingIds: ["F2"] },
    { date: "2026-04-08", category: "treatment", description: "Orthopedic follow-up: partial-thickness supraspinatus tear per MRI. Referred to Bayside Physical Therapy, 2x/week for 6 weeks, with a possible injection later and a return visit in 3 weeks.", evidence: [ev("doc-09", "shows a partial-thickness tear of the supraspinatus tendon"), ev("doc-09", "Plan: Physical therapy, referral to Bayside Physical Therapy, 2x/week for 6 weeks.")], relatedFindingIds: ["F3"] },
    { date: "2026-04-10", category: "records_and_bills", description: "Records and bills requested from St. Brendan; bill requested from Harborview Fire Rescue.", evidence: [ev("doc-11", "04/10/2026 DW — Records and bills requested from St. Brendan (HIM dept.) and bill requested from Harborview Fire Rescue (billing).")], relatedFindingIds: [] },
    { date: "2026-04-28", category: "records_and_bills", description: "St. Brendan ER records (certified complete, 3 pages) and itemized bill ($4,262.00) received. The bill notes that radiology interpretation is billed separately by Lakeside Radiology Group.", evidence: [ev("doc-11", "04/28/2026 DW — St. Brendan ER records (3 pp) and itemized bill received."), ev("doc-07", "Radiology interpretation (professional component) is billed separately by Lakeside Radiology Group.")], relatedFindingIds: ["F5"] },
    { date: "2026-04-29", category: "treatment", description: "Orthopedic visit with Dr. Calloway. The office note had not been finalized when the provider responded on 06/01.", evidence: [ev("doc-09", "The office note for date of service 04/29/2026 had not been finalized by the treating provider at the time of processing.")], relatedFindingIds: ["F1"] },
    { date: "2026-04-30", category: "records_and_bills", description: "Harborview Fire Rescue ambulance bill received ($1,240.00).", evidence: [ev("doc-11", "04/30/2026 DW — Harborview Fire Rescue bill received ($1,240.00).")], relatedFindingIds: [] },
    { date: "2026-05-04", category: "treatment", description: "Client began physical therapy at Bayside Physical Therapy, 2x/week (client-reported).", evidence: [ev("doc-10", "Client started PT at Bayside Physical Therapy on 05/04/2026, 2x/week.")], relatedFindingIds: ["F3"] },
    { date: "2026-05-05", category: "records_and_bills", description: "Records and bills requested from Northgate Spine & Chiropractic.", evidence: [ev("doc-11", "05/05/2026 DW — Records and bills requested from Northgate Spine & Chiropractic.")], relatedFindingIds: ["F8", "F9"] },
    { date: "2026-05-12", category: "records_and_bills", description: "Records and itemized billing requested from Harborview Orthopedic Associates by fax, for dates of service from 03/18/2026 to the present.", evidence: [ev("doc-08", "Please provide the following for all dates of service from 03/18/2026 through the present:")], relatedFindingIds: ["F1"] },
    { date: "2026-05-20", category: "insurance", description: "MedPay application submitted to Lakeshore with the St. Brendan and ambulance bills.", evidence: [ev("doc-11", "05/20/2026 DW — MedPay application submitted to Lakeshore with St. Brendan and Harborview Fire Rescue bills.")], relatedFindingIds: [] },
    { date: "2026-06-03", category: "records_and_bills", description: "Harborview Ortho sent partial records (03/18 and 04/08 only). The 04/29 note was pending, and billing must be requested from the billing office. CMS task T-106 was marked Completed the same day.", evidence: [ev("doc-09", "RECEIVED BY FAX 06/03/2026 — CALDER & WYNN INJURY LAW"), ev("doc-12", "T-106 | Request records & bills — Harborview Orthopedic Associates | Assigned: D. Whitfield | Created 04/28/2026 | Due 05/12/2026 | Status: Completed | Completed 06/03/2026")], relatedFindingIds: ["F1"] },
    { date: "2026-06-10", category: "records_and_bills", description: "CMS note records Northgate records and bills as received and the request as complete. The document index lists a records file only (DOS 03/10–05/28).", evidence: [ev("doc-11", "06/10/2026 DW — Northgate Chiro records and bills received. Request complete."), ev("doc-14", "06/10/2026 | Northgate Chiro Records DOS 03-10-2026 to 05-28-2026.pdf")], relatedFindingIds: ["F8", "F9"] },
    { date: "2026-06-14", category: "treatment", description: "Urgent care visit at QuickCare Urgent Care (Eastside) for a neck pain flare-up (client-reported on 06/20).", evidence: [ev("doc-10", "she went to QuickCare Urgent Care (Eastside) on 06/14/2026 and was given a muscle relaxer.")], relatedFindingIds: ["F4"] },
    { date: "2026-06-18", category: "insurance", description: "Lakeshore issued MedPay payments of $4,262.00 to St. Brendan and $738.00 to Harborview Fire Rescue, exhausting the $5,000 limit.", evidence: [ev("doc-13", "MedPay payments have been issued: $4,262.00 to St. Brendan Regional Medical Center (check no. 0081472) and $738.00 to Harborview Fire Rescue (check no. 0081473).")], relatedFindingIds: [] },
    { date: "2026-06-24", category: "insurance", description: "Call with the Granite Mutual adjuster: BI limits will be disclosed only on a written request with client authorization.", evidence: [ev("doc-11", "06/24/2026 DW — Called Tom Bellamy re: BI limits.")], relatedFindingIds: ["F7"] },
    { date: "2026-07-01", category: "insurance", description: "Written BI policy limits request emailed to Granite Mutual with the signed client authorization.", evidence: [ev("doc-13", "we formally request disclosure of all bodily injury liability limits applicable to your insured, Kevin Marsh")], relatedFindingIds: ["F7"] },
    { date: "2026-07-15", category: "insurance", description: "CMS note records a call in which the adjuster accepted liability. No written confirmation is in the file.", evidence: [ev("doc-11", "07/15/2026 DW — Spoke w/ Tom Bellamy. Liability accepted.")], relatedFindingIds: ["F6"] },
    { date: "2026-07-22", category: "insurance", description: "CMS note records receipt of a Granite Mutual declarations page showing BI limits of $50,000/$100,000. The page is not in the review package.", evidence: [ev("doc-11", "07/22/2026 DW — Received Granite Mutual declarations page. BI limits $50,000/$100,000. Saved to file.")], relatedFindingIds: ["F7"] },
    { date: "2026-07-24", category: "treatment", description: "Client discharged from chiropractic care (client-reported).", evidence: [ev("doc-10", "Client finished PT at Bayside on 07/31/2026 and was discharged from chiro on 07/24/2026.")], relatedFindingIds: ["F9"] },
    { date: "2026-07-31", category: "treatment", description: "Client finished physical therapy at Bayside (client-reported).", evidence: [ev("doc-11", "08/14/2026 DW — Client completed PT 07/31. Discharged from chiro 07/24. Still following with ortho.")], relatedFindingIds: ["F3"] },
    { date: "2026-08-10", category: "treatment", description: "Orthopedic visit with Dr. Calloway (client-reported). The shoulder is still painful, a possible injection was discussed, and a follow-up is planned in 6 weeks.", evidence: [ev("doc-10", "Saw Dr. Calloway on 08/10/2026 — shoulder still painful. Dr. Calloway discussed a possible injection and wants to see her again in 6 weeks.")], relatedFindingIds: ["F1", "F10"] },
    { date: "2026-08-12", category: "client_contact", description: "Client gave a new cell number. The old number was to be disconnected after 08/31.", evidence: [ev("doc-10", "Client gave a new cell number: (216) 555-0163. Her old number will be disconnected after 08/31.")], relatedFindingIds: ["F12"] },
    { date: "2026-08-19", category: "insurance", description: "Granite Mutual email: the limits request is pending with underwriting, and the liability investigation remains open pending a recorded statement from the insured.", evidence: [ev("doc-13", "The policy limits request has been forwarded to our underwriting department and we will respond in writing once it has been reviewed."), ev("doc-13", "please note that our liability investigation remains open. We are still attempting to obtain a recorded statement from our insured")], relatedFindingIds: ["F6", "F7"] },
    { date: "2026-09-10", category: "records_and_bills", description: "Follow-up email to Harborview Ortho asking for the 04/29 note, records for visits after 05/12, and itemized billing. No response is in the file.", evidence: [ev("doc-13", "Please send that note and any records for visits after 05/12/2026."), ev("doc-13", "Billing office: please send an itemized statement for all dates of service from 03/18/2026 to present.")], relatedFindingIds: ["F1"] },
    { date: "2026-09-15", category: "records_and_bills", description: "Follow-up email to Northgate billing stating that no itemized billing statement had been received. No response is in the file.", evidence: [ev("doc-13", "We have not received an itemized billing statement for Ms. Johnson's chiropractic treatment")], relatedFindingIds: ["F8"] },
    { date: "2026-09-22", category: "client_contact", description: "Client voicemail asking for an update and whether she needs to send anything. The callback task is still open.", evidence: [ev("doc-10", "VM from client asking for an update on her case and whether she needs to send us anything. Callback needed."), ev("doc-12", "T-113 | Return client voicemail | Assigned: D. Whitfield | Created 09/22/2026 | Due 09/23/2026 | Status: Open")], relatedFindingIds: ["F11"] },
    { date: "2026-10-24", category: "administrative", description: "Previous case manager's last day.", evidence: [ev("doc-15", "Dana Whitfield's last day was 10/24/2026.")], relatedFindingIds: [] },
    { date: "2026-10-31", category: "administrative", description: "Reassignment memo issued. It states liability accepted, BI limits $50k/$100k and treatment completed, all taken from the CMS. The supervisor notes the underlying documents were not reviewed in detail.", evidence: [ev("doc-15", "Treatment: Client has completed treatment."), ev("doc-15", "I have not reviewed the underlying documents in detail.")], relatedFindingIds: ["F6", "F7", "F10"] },
  ],

  findings: [
    {
      id: "F1",
      category: "confirmed_incomplete",
      categoryBasis: "document_states_gap",
      gapType: "missing_document",
      title: "Harborview Orthopedic records and bills are incomplete",
      explanation:
        "The provider's 06/01 response released notes for only two visits (03/18 and 04/08). It said the 04/29 note was not yet finalized and that billing must be requested from the billing office. The CMS task for this request (T-106) was marked Completed on the day the partial response arrived. A follow-up was emailed on 09/10, but no response is in the file. The client also reported an 08/10 visit that falls after the 05/12 request and is covered only by the 09/10 follow-up.",
      priority: "high",
      operationalImpact:
        "Orthopedics is the client's main ongoing treatment. The records and bills package cannot be assembled without the remaining visit notes and the itemized billing.",
      evidence: [
        ev("doc-09", "The office note for date of service 04/29/2026 had not been finalized by the treating provider at the time of processing."),
        ev("doc-09", "Itemized billing statements are maintained by our billing office and must be requested directly from Harborview Orthopedic Billing"),
        ev("doc-12", "T-106 | Request records & bills — Harborview Orthopedic Associates | Assigned: D. Whitfield | Created 04/28/2026 | Due 05/12/2026 | Status: Completed | Completed 06/03/2026", "Task closed despite partial release"),
        ev("doc-13", "Please send that note and any records for visits after 05/12/2026."),
        ev("doc-10", "Saw Dr. Calloway on 08/10/2026 — shoulder still painful."),
      ],
      couldNotEstablish:
        "Whether anything arrived in response to the 09/10 follow-up. Also not established: whether the $28.50 copy fee (invoice HOA-ROI-55102) was paid, or what visits took place after 08/10.",
      recommendedNextStep:
        "Contact Harborview Ortho release-of-information and billing about the 09/10 request. Ask for the 04/29 note, records for all visits through the present, and an itemized statement, and confirm whether invoice HOA-ROI-55102 is outstanding.",
    },
    {
      id: "F2",
      category: "confirmed_incomplete",
      categoryBasis: "document_states_gap",
      gapType: "missing_request",
      title: "ClearView Imaging MRI report and bill have not been obtained",
      explanation:
        "The orthopedic records show a left shoulder MRI at ClearView Imaging Center on 04/02/2026. The provider list (last updated 06/10) shows ClearView records and bills as not yet requested, and CMS task T-107 to request them is still open in the 11/02 export, five months past its 06/01 due date. No MRI report, bill or request letter is in the file.",
      priority: "high",
      operationalImpact:
        "The MRI is the imaging study behind the orthopedic diagnosis. The file currently relies on the orthopedist's summary of the imaging report rather than the report itself, and the MRI charge is not in the bills.",
      evidence: [
        ev("doc-09", "MRI left shoulder performed 04/02/2026 at ClearView Imaging Center"),
        ev("doc-05", "Records: Not yet requested"),
        ev("doc-12", "T-107 | Request MRI report & bill — ClearView Imaging Center | Assigned: D. Whitfield | Created 04/28/2026 | Due 06/01/2026 | Status: Open"),
      ],
      couldNotEstablish: "Whether a request was sent after 06/10 without being recorded in the CMS.",
      recommendedNextStep: "Request the MRI report and an itemized bill from ClearView Imaging Center for DOS 04/02/2026, after checking the CMS for any unrecorded request.",
    },
    {
      id: "F3",
      category: "potentially_incomplete",
      categoryBasis: "no_record_found",
      gapType: "missing_request",
      title: "Physical therapy at Bayside Physical Therapy is not tracked",
      explanation:
        "The orthopedist referred the client to Bayside Physical Therapy on 04/08. The client reported starting PT there on 05/04 and finishing on 07/31. Bayside does not appear on the provider list, there is no CMS task for it, and the file has no request, records or bills from Bayside.",
      priority: "high",
      operationalImpact:
        "About three months of reported treatment is not on the provider list, so it could be left out of records and bills collection entirely.",
      evidence: [
        ev("doc-09", "Plan: Physical therapy, referral to Bayside Physical Therapy, 2x/week for 6 weeks."),
        ev("doc-10", "Client started PT at Bayside Physical Therapy on 05/04/2026, 2x/week."),
        ev("doc-10", "Client finished PT at Bayside on 07/31/2026"),
        ev("doc-05", "Last updated: 06/10/2026", "Provider list predates the client's later reports and does not include Bayside"),
      ],
      couldNotEstablish:
        "Whether a request was made outside the CMS. The PT dates of service come only from the client's account.",
      recommendedNextStep: "Confirm the PT dates with the client, add Bayside to the provider list, and request complete records and an itemized bill.",
    },
    {
      id: "F4",
      category: "potentially_incomplete",
      categoryBasis: "no_record_found",
      gapType: "missing_request",
      title: "Urgent care visit on 06/14/2026 is not tracked",
      explanation:
        "The client reported a visit to QuickCare Urgent Care (Eastside) on 06/14 for a neck pain flare-up. The previous case manager told her it would be added to the provider list. The list was last updated 06/10, before the call, and does not include it. No request, records or bill are in the file.",
      priority: "medium",
      operationalImpact: "A reported visit with no request behind it is easy to miss when records and bills are assembled.",
      evidence: [
        ev("doc-10", "she went to QuickCare Urgent Care (Eastside) on 06/14/2026 and was given a muscle relaxer."),
        ev("doc-10", "Told client we would add the urgent care visit to her provider list."),
      ],
      couldNotEstablish: "Whether records or a bill were requested. The visit date is client-reported only.",
      recommendedNextStep: "Add QuickCare Urgent Care (Eastside) to the provider list and request records and an itemized bill for DOS 06/14/2026.",
    },
    {
      id: "F5",
      category: "potentially_incomplete",
      categoryBasis: "no_record_found",
      gapType: "missing_request",
      title: "Separate radiology bill for the ER X-rays may be missing",
      explanation:
        "The St. Brendan itemized statement says radiology interpretation is billed separately by Lakeside Radiology Group, and the ER record confirms Lakeside provided the final reads. No Lakeside bill or request appears in the file or the CMS.",
      priority: "low",
      operationalImpact: "The ER date-of-service charges are not complete without the radiologist's professional fee.",
      evidence: [
        ev("doc-07", "Radiology interpretation (professional component) is billed separately by Lakeside Radiology Group."),
        ev("doc-06", "Final radiology interpretation by Lakeside Radiology Group."),
      ],
      couldNotEstablish: "Whether Lakeside billed the client or the health plan, or what the charge is.",
      recommendedNextStep: "Request an itemized bill (and the final radiology reports) from Lakeside Radiology Group for DOS 03/04/2026.",
    },
    {
      id: "F6",
      category: "conflicting",
      categoryBasis: "sources_disagree",
      gapType: "conflicting_records",
      title: "Liability status: CMS says accepted, adjuster's later email says still under investigation",
      explanation:
        "A CMS note dated 07/15 records a call in which the adjuster accepted liability, and the reassignment memo repeats this. The adjuster's email of 08/19, five weeks later, says the liability investigation remains open pending a recorded statement from the insured. No written confirmation that liability was accepted is in the file.",
      priority: "high",
      operationalImpact:
        "The reassignment memo presents liability as settled. If that is wrong, the attorney and supervisor are relying on incorrect status information.",
      evidence: [
        ev("doc-11", "07/15/2026 DW — Spoke w/ Tom Bellamy. Liability accepted."),
        ev("doc-13", "please note that our liability investigation remains open. We are still attempting to obtain a recorded statement from our insured"),
        ev("doc-15", "Liability: Accepted by Granite Mutual (per CMS note 07/15)."),
      ],
      couldNotEstablish: "Granite Mutual's current liability position. The documents don't resolve the conflict.",
      recommendedNextStep: "Ask the adjuster for Granite Mutual's current liability position in writing, and flag the discrepancy to the assigned attorney. Don't treat liability as accepted until it is confirmed.",
    },
    {
      id: "F7",
      category: "conflicting",
      categoryBasis: "sources_disagree",
      gapType: "conflicting_records",
      title: "BI policy limits: recorded as $50k/$100k, but the adjuster says the request is still pending",
      explanation:
        "A CMS note dated 07/22 says a Granite Mutual declarations page showing BI limits of $50,000/$100,000 was received and saved to file, and the document index lists it. The declarations page was not in the review package, so its contents can't be checked. On 08/19 the adjuster wrote that the 07/01 limits request was still with underwriting. The insurance summary still shows limits as not disclosed, but it was last updated on 06/24, before either entry.",
      priority: "high",
      operationalImpact:
        "The reassignment memo reports limits of $50k/$100k. The figure rests on a document that couldn't be checked and is contradicted by the adjuster's later email.",
      evidence: [
        ev("doc-11", "07/22/2026 DW — Received Granite Mutual declarations page. BI limits $50,000/$100,000. Saved to file."),
        ev("doc-14", "07/22/2026 | Granite Mutual Declarations Page.pdf | Insurance | D. Whitfield"),
        ev("doc-13", "The policy limits request has been forwarded to our underwriting department and we will respond in writing once it has been reviewed."),
        ev("doc-15", "BI limits: $50k/$100k (per CMS note 07/22)."),
      ],
      couldNotEstablish:
        "Whether the declarations page exists in the CMS folder, which policy it covers, or what limits it shows.",
      recommendedNextStep:
        "Retrieve the declarations page from the CMS document folder and check what it shows. Ask the adjuster in writing for the status of the 07/01 request. Flag the discrepancy to the assigned attorney.",
    },
    {
      id: "F8",
      category: "conflicting",
      categoryBasis: "sources_disagree",
      gapType: "conflicting_records",
      title: "Northgate Chiropractic bills: recorded as received, later recorded as never sent",
      explanation:
        "The 06/10 CMS note and the provider list both record Northgate bills as received. On 09/15, a CMS note and an email to Northgate billing both say no itemized bill had been received. The document index lists a Northgate records file but no Northgate bill. No reply to the 09/15 email is in the file.",
      priority: "medium",
      operationalImpact: "Chiropractic ran from March to July, so its charges are likely a significant part of the bills.",
      evidence: [
        ev("doc-11", "06/10/2026 DW — Northgate Chiro records and bills received. Request complete."),
        ev("doc-05", "Bills: Received 06/10/2026"),
        ev("doc-11", "09/15/2026 DW — Northgate Chiro still has not sent itemized bills."),
        ev("doc-13", "We have not received an itemized billing statement for Ms. Johnson's chiropractic treatment"),
      ],
      couldNotEstablish: "Whether a Northgate bill exists anywhere in the CMS, or whether Northgate replied to the 09/15 follow-up.",
      recommendedNextStep: "Check the CMS document folder for any Northgate billing, then contact Northgate billing about the 09/15 request.",
    },
    {
      id: "F9",
      category: "potentially_incomplete",
      categoryBasis: "no_record_found",
      gapType: "missing_document",
      title: "Northgate Chiropractic records are not in the review package and may stop at 05/28",
      explanation:
        "The CMS document index lists Northgate records for DOS 03/10–05/28/2026, but the file was not in the review package. The client reported being discharged from chiropractic on 07/24. If the index entry is accurate, nothing on file covers treatment from 05/29 to 07/24.",
      priority: "medium",
      operationalImpact: "The chiropractic records may be missing roughly two months of treatment.",
      evidence: [
        ev("doc-14", "06/10/2026 | Northgate Chiro Records DOS 03-10-2026 to 05-28-2026.pdf"),
        ev("doc-14", "It does not confirm which files were included in the reassignment review package."),
        ev("doc-10", "discharged from chiro on 07/24/2026"),
      ],
      couldNotEstablish: "What the Northgate records file contains, or whether later records were requested.",
      recommendedNextStep: "Retrieve the Northgate records file from the CMS, check its date range, and request records from 05/29/2026 through discharge.",
    },
    {
      id: "F10",
      category: "conflicting",
      categoryBasis: "sources_disagree",
      gapType: "conflicting_records",
      title: "Treatment status: memo says completed, client's last report says ongoing orthopedic care",
      explanation:
        "The reassignment memo says the client has completed treatment. The client's most recent treatment update (08/12) said her shoulder was still painful after an 08/10 orthopedic visit, an injection had been discussed, and a follow-up was planned in 6 weeks. The 08/14 CMS note also says she was still following with ortho. Nothing after 08/12 documents her treatment status.",
      priority: "medium",
      operationalImpact:
        "The memo frames the case as nearly ready for a demand package. If treatment is ongoing, records and bills collection isn't finished, and any further visits (for example, an injection) would need tracking.",
      evidence: [
        ev("doc-15", "Treatment: Client has completed treatment."),
        ev("doc-10", "Dr. Calloway discussed a possible injection and wants to see her again in 6 weeks."),
        ev("doc-11", "Still following with ortho."),
      ],
      couldNotEstablish: "The client's current treatment status. No treatment information after 08/12 is in the file.",
      recommendedNextStep: "Confirm current treatment status with the client, including any orthopedic follow-up or injection since 08/10, and correct the status passed to the supervisor and attorney.",
    },
    {
      id: "F11",
      category: "unverified",
      categoryBasis: "no_record_found",
      gapType: "unverified_outcome",
      title: "Client voicemail of 09/22 has no recorded callback",
      explanation:
        "The client left a voicemail on 09/22 asking for an update and whether she needs to send anything. The task to return the call (T-113) and the September and October check-in tasks are open. No client contact is recorded after 09/22.",
      priority: "high",
      operationalImpact:
        "The client is waiting on a response to a direct question, and nearly two months have passed. She is also the only source for several providers that are missing from the file.",
      evidence: [
        ev("doc-10", "VM from client asking for an update on her case and whether she needs to send us anything. Callback needed."),
        ev("doc-12", "T-113 | Return client voicemail | Assigned: D. Whitfield | Created 09/22/2026 | Due 09/23/2026 | Status: Open"),
        ev("doc-12", "T-111 | Monthly client check-in — September | Assigned: D. Whitfield | Created 09/01/2026 | Due 09/15/2026 | Status: Open"),
        ev("doc-12", "T-114 | Monthly client check-in — October | Assigned: D. Whitfield | Created 10/01/2026 | Due 10/15/2026 | Status: Open"),
      ],
      couldNotEstablish: "Whether the client was called back outside the CMS. Open tasks show only that nothing was recorded.",
      recommendedNextStep: "Call the client on the number she gave on 08/12 to introduce yourself, answer her 09/22 question and confirm her current treatment and providers.",
    },
    {
      id: "F12",
      category: "conflicting",
      categoryBasis: "sources_disagree",
      gapType: "conflicting_records",
      title: "Client phone number on file is out of date",
      explanation:
        "The client information sheet (last updated 03/06) lists (216) 555-0142. On 08/12 the client gave a new number, (216) 555-0163, and said the old one would be disconnected after 08/31. The sheet has not been updated.",
      priority: "medium",
      operationalImpact: "Calls or texts to the number on the information sheet are unlikely to reach the client.",
      evidence: [
        ev("doc-03", "Phone (cell): (216) 555-0142"),
        ev("doc-03", "Last updated: 03/06/2026 (P. Nair)"),
        ev("doc-10", "Client gave a new cell number: (216) 555-0163. Her old number will be disconnected after 08/31."),
      ],
      couldNotEstablish: "Whether the number was updated elsewhere in the CMS.",
      recommendedNextStep: "Confirm the new number with the client and update the client record.",
    },
  ],

  completedWork: [
    { id: "C1", title: "Letters of representation sent and acknowledged by both carriers", basis: "outcome_documented", explanation: "Both carriers acknowledged in writing and assigned claim numbers.", evidence: [ev("doc-11", "03/09/2026 DW — Letters of representation sent to Granite Mutual (BI) and Lakeshore Auto (MedPay) by email and mail."), ev("doc-13", "We acknowledge receipt of your letter of representation. This loss has been assigned claim number GM-26-0448812."), ev("doc-13", "I can confirm that policy LAK-883016 includes Medical Payments coverage of $5,000 per person.")] },
    { id: "C2", title: "Police crash report obtained", basis: "outcome_documented", explanation: "The report itself is in the file.", evidence: [ev("doc-02", "Date/time of crash: 03/04/2026 17:42"), ev("doc-11", "03/27/2026 DW — Police report received and saved to file.")] },
    { id: "C3", title: "St. Brendan ER records obtained (complete for 03/04/2026)", basis: "outcome_documented", explanation: "The records are in the file with a certification that they are complete.", evidence: [ev("doc-06", "Certified copy of the complete emergency department record for date of service 03/04/2026 (3 pages) released to Calder & Wynn Injury Law on 04/24/2026.")] },
    { id: "C4", title: "St. Brendan itemized bill obtained ($4,262.00)", basis: "outcome_documented", explanation: "The itemized statement is in the file. It covers facility and ED physician charges only; see F5 for the separate radiology bill.", evidence: [ev("doc-07", "Total charges: $4,262.00")] },
    { id: "C5", title: "Ambulance bill obtained ($1,240.00)", basis: "outcome_documented", explanation: "The Harborview Fire Rescue billing statement is in the file.", evidence: [ev("doc-07", "BLS emergency transport — $1,050.00"), ev("doc-07", "Total charges: $1,240.00")] },
    { id: "C6", title: "MedPay claimed and paid; $5,000 limit exhausted", basis: "outcome_documented", explanation: "Lakeshore confirmed in writing that payments were issued and the limit is exhausted.", evidence: [ev("doc-11", "05/20/2026 DW — MedPay application submitted to Lakeshore with St. Brendan and Harborview Fire Rescue bills."), ev("doc-13", "This exhausts the $5,000.00 Medical Payments limit on this claim.")] },
    { id: "C7", title: "Harborview Ortho records for 03/18 and 04/08 obtained", basis: "outcome_documented", explanation: "Both visit notes are in the file. The rest of the request is outstanding (see F1).", evidence: [ev("doc-09", "Enclosed are office visit notes for dates of service 03/18/2026 and 04/08/2026 (2 pages)."), ev("doc-09", "OFFICE VISIT — 03/18/2026")] },
    { id: "C8", title: "Written BI policy limits request sent to Granite Mutual", basis: "action_documented", explanation: "The request and authorization were sent on 07/01. The outcome is disputed (see F7).", evidence: [ev("doc-13", "we formally request disclosure of all bodily injury liability limits applicable to your insured, Kevin Marsh")] },
    { id: "C9", title: "Follow-ups sent to Harborview Ortho (09/10) and Northgate billing (09/15)", basis: "action_documented", explanation: "Both follow-up emails are in the file. No responses are in the file.", evidence: [ev("doc-13", "Please send that note and any records for visits after 05/12/2026."), ev("doc-13", "Following up on our request of 05/05/2026.")] },
    { id: "C10", title: "Regular client contact from March through August", basis: "outcome_documented", explanation: "The communication log shows check-ins in April, May, June, July and August. These calls are the source of the client-reported treatment details.", evidence: [ev("doc-10", "04/15/2026 | Phone (outbound) | D. Whitfield"), ev("doc-10", "05/14/2026 | Phone (outbound) | D. Whitfield"), ev("doc-10", "08/12/2026 | Phone (inbound) | D. Whitfield")] },
  ],

  outstandingWork: [
    { id: "O1", title: "Harborview Ortho: 04/29 note, post-05/12 records and itemized billing", status: "confirmed_outstanding", explanation: "The provider's letter confirms these were not released. The 09/10 follow-up has no recorded response, and task T-112 is open.", relatedFindingIds: ["F1"], evidence: [ev("doc-09", "The office note for date of service 04/29/2026 had not been finalized by the treating provider at the time of processing."), ev("doc-12", "T-112 | Follow up — Harborview Ortho 04/29 office note | Assigned: D. Whitfield | Created 06/03/2026 | Due 07/03/2026 | Status: Open")] },
    { id: "O2", title: "ClearView Imaging: MRI report and bill", status: "confirmed_outstanding", explanation: "Task T-107 is open, and the provider list shows them as not yet requested.", relatedFindingIds: ["F2"], evidence: [ev("doc-12", "T-107 | Request MRI report & bill — ClearView Imaging Center | Assigned: D. Whitfield | Created 04/28/2026 | Due 06/01/2026 | Status: Open")] },
    { id: "O3", title: "Northgate Chiropractic: itemized bills", status: "confirmed_outstanding", explanation: "As of the firm's 09/15 email, no itemized bill had been received. Nothing later is in the file.", relatedFindingIds: ["F8"], evidence: [ev("doc-13", "We have not received an itemized billing statement for Ms. Johnson's chiropractic treatment")] },
    { id: "O4", title: "Granite Mutual: response to the 07/01 policy limits request", status: "confirmed_outstanding", explanation: "As of 08/19, the adjuster reported the request as pending with underwriting.", relatedFindingIds: ["F7"], evidence: [ev("doc-13", "The policy limits request has been forwarded to our underwriting department")] },
    { id: "O5", title: "Return the client's 09/22 voicemail; September and October check-ins", status: "status_unknown", explanation: "The tasks are open in the CMS. The file doesn't show whether contact happened outside it.", relatedFindingIds: ["F11"], evidence: [ev("doc-12", "T-113 | Return client voicemail | Assigned: D. Whitfield | Created 09/22/2026 | Due 09/23/2026 | Status: Open")] },
    { id: "O6", title: "Bayside Physical Therapy: records and bills", status: "status_unknown", explanation: "There is no request, task or provider list entry, so it is not established whether anything was requested.", relatedFindingIds: ["F3"], evidence: [ev("doc-10", "Client started PT at Bayside Physical Therapy on 05/04/2026, 2x/week.")] },
    { id: "O7", title: "QuickCare Urgent Care: records and bill (DOS 06/14/2026)", status: "status_unknown", explanation: "There is no request or provider list entry.", relatedFindingIds: ["F4"], evidence: [ev("doc-10", "she went to QuickCare Urgent Care (Eastside) on 06/14/2026")] },
    { id: "O8", title: "Northgate Chiropractic: records after 05/28/2026", status: "status_unknown", explanation: "The indexed records file appears to end at 05/28, and treatment reportedly continued to 07/24.", relatedFindingIds: ["F9"], evidence: [ev("doc-14", "Northgate Chiro Records DOS 03-10-2026 to 05-28-2026.pdf")] },
    { id: "O9", title: "Lakeside Radiology Group: radiology professional fee bill", status: "status_unknown", explanation: "This bill is referenced on the St. Brendan statement, and no request is recorded.", relatedFindingIds: ["F5"], evidence: [ev("doc-07", "Radiology interpretation (professional component) is billed separately by Lakeside Radiology Group.")] },
    { id: "O10", title: "Granite Mutual: liability determination", status: "status_unknown", explanation: "Records conflict on whether liability has been decided.", relatedFindingIds: ["F6"], evidence: [ev("doc-13", "please note that our liability investigation remains open")] },
    { id: "O11", title: "Lakeshore: confirm UM/UIM coverage limits", status: "status_unknown", explanation: "As of 06/24 the limits had not been confirmed, and nothing later is in the file.", relatedFindingIds: [], evidence: [ev("doc-04", "UM/UIM: Client reports she has UM/UIM coverage. Limits not yet confirmed.")] },
  ],

  recoveryPlan: [
    {
      id: "A1", order: 1, priority: "high",
      action: "Call the client: introduce yourself, answer her 09/22 voicemail and confirm current treatment and providers",
      rationale: "Her question has had no recorded response for nearly two months. She is also the only source for several providers and dates that are missing from the file.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts the client",
      relatedFindingIds: ["F11", "F12", "F10", "F3", "F4"],
      evidence: [ev("doc-10", "VM from client asking for an update on her case and whether she needs to send us anything. Callback needed.")],
      draft: {
        kind: "call_script", to: "Sarah Johnson — (216) 555-0163 (number given 08/12/2026; confirm)", subject: null,
        body:
          "Hi Ms. Johnson, this is [your name] from Calder & Wynn. I'm your new case manager, taking over from Dana Whitfield. I'm sorry nobody got back to you after your voicemail in September.\n\nTo answer your question about whether you need to send us anything: [answer after reviewing].\n\nA few things I'd like to confirm so your file is complete:\n1. Is (216) 555-0163 still the best number for you?\n2. Are you still seeing Dr. Calloway? Have you had any visits since 08/10, or the injection she discussed?\n3. Your physical therapy at Bayside: did it run from 05/04 to 07/31?\n4. The QuickCare Urgent Care visit on 06/14: was that the only urgent care visit?\n5. Have you seen any other doctors or providers since the accident that we haven't discussed?\n\nI'll follow up with [next step] by [date].",
      },
    },
    {
      id: "A2", order: 2, priority: "high",
      action: "Update the client's phone number in the client record",
      rationale: "The information sheet still shows a number the client said would be disconnected after 08/31.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Changes a client record (do this manually in the CMS after confirming with the client)",
      relatedFindingIds: ["F12"], evidence: [ev("doc-10", "Client gave a new cell number: (216) 555-0163.")], draft: null,
    },
    {
      id: "A3", order: 3, priority: "high",
      action: "Retrieve the Granite Mutual declarations page and the Northgate records file from the CMS document folder",
      rationale: "Both are listed in the CMS index but were not in the review package. They are needed to resolve F7, F8 and F9, and the files may already exist.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: false, approvalReason: null,
      relatedFindingIds: ["F7", "F8", "F9"],
      evidence: [ev("doc-14", "07/22/2026 | Granite Mutual Declarations Page.pdf | Insurance | D. Whitfield"), ev("doc-14", "06/10/2026 | Northgate Chiro Records DOS 03-10-2026 to 05-28-2026.pdf")],
      draft: null,
    },
    {
      id: "A4", order: 4, priority: "high",
      action: "Flag the liability, limits and treatment-status discrepancies to the assigned attorney and supervisor",
      rationale: "The reassignment memo gives liability as accepted, limits as $50k/$100k and treatment as complete. The documents don't support any of these as settled.",
      suggestedOwner: "Incoming case manager → Marcus Hale (assigned attorney), Lauren Pike (supervisor)",
      ownerBasis: "Liability and readiness for a demand are attorney decisions; the memo came from the supervisor.",
      requiresApproval: true, approvalReason: "Sends an internal message",
      relatedFindingIds: ["F6", "F7", "F10"],
      evidence: [ev("doc-15", "Liability: Accepted by Granite Mutual (per CMS note 07/15).")],
      draft: {
        kind: "internal_note", to: "Marcus Hale; Lauren Pike", subject: "Johnson (CW-2026-0187) — status items that need confirming",
        body:
          "Marcus, Lauren — after reviewing the Johnson file, three items in the reassignment summary don't match the underlying documents:\n\n1. Liability: The CMS note of 07/15 says liability was accepted by phone. Granite Mutual's 08/19 email says the liability investigation remains open pending a recorded statement from their insured. There is no written acceptance in the file.\n2. BI limits: The CMS note of 07/22 records a declarations page showing $50,000/$100,000. The 08/19 email says the 07/01 limits request is still with underwriting. I'm retrieving the declarations page from the CMS folder to check it.\n3. Treatment: The client's last update (08/12) was that she was still seeing Dr. Calloway, with a possible injection and a follow-up in 6 weeks. I'm confirming current status with her.\n\nI'll ask the adjuster for written confirmation on items 1 and 2. Records collection also has open items (ortho, MRI, PT, urgent care, chiro bills), which I'm working through.\n\n[Your name]",
      },
    },
    {
      id: "A5", order: 5, priority: "high",
      action: "Ask the Granite Mutual adjuster for written confirmation of the liability position and the status of the 07/01 limits request",
      rationale: "The CMS and the adjuster's own 08/19 email conflict on both points.",
      suggestedOwner: "Incoming case manager (after attorney review of the wording)",
      ownerBasis: "Correspondence with the adverse carrier on liability should be reviewed by the assigned attorney before sending.",
      requiresApproval: true, approvalReason: "Contacts a third party (adverse carrier)",
      relatedFindingIds: ["F6", "F7"],
      evidence: [ev("doc-13", "The policy limits request has been forwarded to our underwriting department and we will respond in writing once it has been reviewed.")],
      draft: {
        kind: "email", to: "Tom Bellamy <tbellamy@granitemutual.example>", subject: "Claim GM-26-0448812 — Claimant Sarah Johnson — status request",
        body:
          "Mr. Bellamy,\n\nI am the new case manager on this matter, taking over from Dana Whitfield. Please direct future correspondence to me.\n\nYour email of 08/19/2026 said our 07/01/2026 policy limits request had been forwarded to underwriting. Please let us know its status and provide the bodily injury limits in writing.\n\nPlease also confirm, in writing, Granite Mutual's current position on liability for the 03/04/2026 collision.\n\nThank you,\n[Your name]\nCase Manager, Calder & Wynn Injury Law\n[Phone] | [Email]",
      },
    },
    {
      id: "A6", order: 6, priority: "high",
      action: "Follow up with Harborview Orthopedic (records and billing)",
      rationale: "Records are partial, billing has not been received, and the 09/10 follow-up has no recorded response.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts a medical provider",
      relatedFindingIds: ["F1"],
      evidence: [ev("doc-09", "A copy fee of $28.50 applies to this release (invoice HOA-ROI-55102).")],
      draft: {
        kind: "email", to: "roi@harborview-ortho.example; billing@harborview-ortho.example", subject: "Records and billing follow-up — Sarah M. Johnson, DOB 06/14/1987",
        body:
          "Hello,\n\nI am following up on our requests of 05/12/2026 and 09/10/2026 for patient Sarah M. Johnson (DOB 06/14/1987). I am the new case manager on this matter.\n\nRecords: Please send the office note for 04/29/2026 and complete records for all dates of service after 04/08/2026 through the present, including 08/10/2026.\n\nBilling: Please send an itemized statement for all dates of service from 03/18/2026 to the present.\n\nPlease also let us know whether invoice HOA-ROI-55102 ($28.50) is still outstanding.\n\nThank you,\n[Your name]\nCase Manager, Calder & Wynn Injury Law",
      },
    },
    {
      id: "A7", order: 7, priority: "high",
      action: "Request the MRI report and bill from ClearView Imaging Center",
      rationale: "Task T-107 has been open since 06/01, and no MRI report or bill is in the file.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts a medical provider",
      relatedFindingIds: ["F2"], evidence: [],
      draft: {
        kind: "letter", to: "ClearView Imaging Center — Medical Records / Release of Information", subject: "Request for imaging report and billing — Sarah M. Johnson, DOB 06/14/1987",
        body:
          "This office represents Sarah M. Johnson (DOB 06/14/1987) regarding injuries from a motor vehicle collision on 03/04/2026.\n\nPlease provide, for the left shoulder MRI performed on 04/02/2026 and any other dates of service:\n1. The complete imaging report(s); and\n2. An itemized billing statement showing all charges, payments and adjustments.\n\nA HIPAA authorization signed by the patient is enclosed. Please contact me if a fee is required before release.\n\n[Your name], Case Manager, Calder & Wynn Injury Law\nEnclosure: HIPAA authorization",
      },
    },
    {
      id: "A8", order: 8, priority: "high",
      action: "Add Bayside Physical Therapy to the provider list and request records and bills",
      rationale: "About three months of reported PT has no request on file.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts a medical provider; changes the provider list",
      relatedFindingIds: ["F3"], evidence: [],
      draft: {
        kind: "letter", to: "Bayside Physical Therapy — Medical Records / Billing", subject: "Request for records and billing — Sarah M. Johnson, DOB 06/14/1987",
        body:
          "This office represents Sarah M. Johnson (DOB 06/14/1987) regarding injuries from a motor vehicle collision on 03/04/2026.\n\nPlease provide complete therapy records (including the initial evaluation, daily notes and discharge summary) and an itemized billing statement for all dates of service, which we understand began on or about 05/04/2026 [confirm dates with client].\n\nA HIPAA authorization signed by the patient is enclosed.\n\n[Your name], Case Manager, Calder & Wynn Injury Law\nEnclosure: HIPAA authorization",
      },
    },
    {
      id: "A9", order: 9, priority: "medium",
      action: "Follow up with Northgate Chiropractic on billing, and request records from 05/29/2026 through discharge",
      rationale: "Bills are recorded both as received and as never sent, and the indexed records appear to end at 05/28.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts a medical provider",
      relatedFindingIds: ["F8", "F9"], evidence: [],
      draft: {
        kind: "email", to: "billing@northgatespine.example", subject: "Records and billing follow-up — Sarah Johnson",
        body:
          "Hello,\n\nI am the new case manager for Sarah Johnson and am following up on our requests of 05/05/2026 and 09/15/2026.\n\nPlease send:\n1. An itemized billing statement for all dates of service beginning 03/10/2026; and\n2. Treatment records for dates of service from 05/29/2026 through her discharge [client reports 07/24/2026].\n\n[Check the CMS folder first: if the bill is already there, limit this request to the records.]\n\nThank you,\n[Your name]\nCase Manager, Calder & Wynn Injury Law",
      },
    },
    {
      id: "A10", order: 10, priority: "medium",
      action: "Request records and bill from QuickCare Urgent Care (Eastside) for 06/14/2026",
      rationale: "A client-reported visit has no request on file.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts a medical provider",
      relatedFindingIds: ["F4"], evidence: [],
      draft: {
        kind: "letter", to: "QuickCare Urgent Care (Eastside) — Medical Records", subject: "Request for records and billing — Sarah M. Johnson, DOB 06/14/1987",
        body:
          "This office represents Sarah M. Johnson (DOB 06/14/1987). Please provide complete records and an itemized billing statement for the visit on or about 06/14/2026 and any other dates of service.\n\nA HIPAA authorization signed by the patient is enclosed.\n\n[Your name], Case Manager, Calder & Wynn Injury Law",
      },
    },
    {
      id: "A11", order: 11, priority: "medium",
      action: "Update the medical provider list",
      rationale: "The list was last updated 06/10. It omits Bayside PT, QuickCare and Lakeside Radiology, and records Northgate bills as received.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Changes a case record (do this manually in the CMS)",
      relatedFindingIds: ["F3", "F4", "F5", "F8"],
      evidence: [ev("doc-05", "Last updated: 06/10/2026")], draft: null,
    },
    {
      id: "A12", order: 12, priority: "low",
      action: "Request the radiology professional fee bill from Lakeside Radiology Group",
      rationale: "The St. Brendan statement says radiology interpretation is billed separately.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts a medical provider",
      relatedFindingIds: ["F5"], evidence: [],
      draft: {
        kind: "letter", to: "Lakeside Radiology Group — Billing", subject: "Request for itemized billing — Sarah M. Johnson, DOB 06/14/1987",
        body:
          "This office represents Sarah M. Johnson (DOB 06/14/1987). Please provide an itemized billing statement, and the final interpretation reports, for radiology services on 03/04/2026 at St. Brendan Regional Medical Center (cervical spine and left shoulder X-rays).\n\nA HIPAA authorization signed by the patient is enclosed.\n\n[Your name], Case Manager, Calder & Wynn Injury Law",
      },
    },
    {
      id: "A13", order: 13, priority: "low",
      action: "Ask Lakeshore to confirm the client's UM/UIM coverage limits",
      rationale: "The client reports UM/UIM coverage, but the limits were not confirmed as of 06/24.",
      suggestedOwner: "Incoming case manager", ownerBasis: null,
      requiresApproval: true, approvalReason: "Contacts a third party (client's carrier)",
      relatedFindingIds: [],
      evidence: [ev("doc-04", "UM/UIM: Client reports she has UM/UIM coverage. Limits not yet confirmed.")],
      draft: {
        kind: "email", to: "Janet Kwan <jkwan@lakeshoreauto.example>", subject: "Claim LS-7731-26 — Sarah Johnson — UM/UIM coverage",
        body:
          "Ms. Kwan,\n\nI am the new case manager for Sarah Johnson on claim LS-7731-26, taking over from Dana Whitfield. Please confirm whether policy LAK-883016 includes UM/UIM coverage and, if so, the applicable limits.\n\nThank you,\n[Your name]\nCase Manager, Calder & Wynn Injury Law",
      },
    },
  ],

  limitations: [
    "Files not in the package: the CMS document index lists files that were not supplied, such as the retainer, the HIPAA authorizations, the Northgate records and the Granite Mutual declarations page, so their contents are not verified (F7, F9).",
    "Email replies: the email export is described as \"selected correspondence\", so replies to the 09/10 and 09/15 follow-ups, or other messages, may exist that were not exported (F1, F8).",
    "Client-reported treatment: treatment at Northgate after 05/28, Bayside PT and QuickCare, and the 08/10 orthopedic visit, are known only from client-reported notes and CMS entries. No records from those providers are in the package (F3, F4, F9, F10).",
    "Activity from 09/22 to 10/31/2026: nothing in the file covers this period apart from the reassignment memo, so it is not established whether any work happened outside the CMS (F11).",
  ],
};

const DEMO_REPORTS: Record<string, TakeoverReport> = { "cw-2026-0187": report };

export function getDemoReport(caseId: string): TakeoverReport | null {
  return DEMO_REPORTS[caseId] ?? null;
}
