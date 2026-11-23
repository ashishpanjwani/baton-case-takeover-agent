/**
 * Structured-output schemas for the investigation.
 *
 * These schemas are used three ways:
 *  1. Sent to the model as the required JSON output format.
 *  2. Used to validate every model response before anything is stored or shown.
 *  3. Used to validate the precomputed demo report.
 *
 * Keep them free of min/max/regex constraints: structured outputs support only
 * a subset of JSON Schema, and semantic checks happen in verify.ts instead.
 *
 * The full TakeoverReportSchema is too large for a single structured-output
 * grammar ("The compiled grammar is too large"), so the model produces it in two
 * parts (ReportPart1Schema, ReportPart2Schema) that the engine merges. After
 * changing a schema, run `npm run check:schemas` to confirm each part still compiles.
 */
import { z } from "zod";

export const EvidenceSchema = z.object({
  docId: z.string().describe("The id attribute of the <document> the quote comes from, e.g. doc-07"),
  quote: z
    .string()
    .describe(
      "An excerpt copied character-for-character from that document. Keep it short (ideally under 30 words) and from a single page. Use '...' only to join two exact fragments from the same page.",
    ),
  page: z.number().nullable().describe("1-based page number for PDF documents; null for text documents"),
  note: z.string().nullable().describe("Optional: what this excerpt shows, in a few words"),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const Priority = z.enum(["high", "medium", "low"]);
export type Priority = z.infer<typeof Priority>;

export const FindingCategory = z.enum([
  "confirmed_incomplete",
  "potentially_incomplete",
  "unverified",
  "conflicting",
]);
export type FindingCategory = z.infer<typeof FindingCategory>;

/**
 * What a finding's category rests on. Code enforces that "confirmed_incomplete"
 * rests on a document that states the gap (see verify.ts); the absence of a
 * record, or an open task alone, is never enough.
 */
export const CategoryBasis = z.enum([
  "document_states_gap",
  "no_record_found",
  "outcome_not_shown",
  "sources_disagree",
]);
export type CategoryBasis = z.infer<typeof CategoryBasis>;

export const GapType = z.enum([
  "missing_document",
  "missing_request",
  "unverified_outcome",
  "conflicting_records",
  "other",
]);
export type GapType = z.infer<typeof GapType>;

export const TimelineCategory = z.enum([
  "incident",
  "treatment",
  "records_and_bills",
  "insurance",
  "client_contact",
  "administrative",
]);

export const OverviewSchema = z.object({
  caseType: z.string(),
  currentStage: z.string(),
  summary: z.string().describe("3-5 sentence operational summary. No legal conclusions."),
  keyEvents: z.array(
    z.object({ date: z.string().describe("YYYY-MM-DD"), description: z.string(), evidence: z.array(EvidenceSchema) }),
  ),
  providers: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      datesOfService: z.string(),
      recordsStatus: z.string().describe("What the supplied documents establish about records, e.g. 'Received (in file)'"),
      billsStatus: z.string(),
      evidence: z.array(EvidenceSchema),
    }),
  ),
  insurance: z.array(
    z.object({
      role: z.string().describe("e.g. 'Adverse carrier (BI)', 'Client auto (MedPay)', 'Health plan'"),
      carrier: z.string(),
      identifiers: z.string().describe("Policy / claim numbers as stated in the documents"),
      details: z.string(),
      evidence: z.array(EvidenceSchema),
    }),
  ),
  lastMeaningfulActivity: z.object({
    date: z.string().describe("YYYY-MM-DD"),
    description: z.string(),
    evidence: z.array(EvidenceSchema),
  }),
});

export const TimelineEventSchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  description: z.string(),
  category: TimelineCategory,
  evidence: z.array(EvidenceSchema),
  relatedFindingIds: z.array(z.string()),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const FindingSchema = z.object({
  id: z.string().describe("F1, F2, ..."),
  category: FindingCategory,
  categoryBasis: CategoryBasis.describe(
    "What the category rests on. document_states_gap: a cited document itself states the gap (e.g. 'Not yet requested', 'partial records', 'not included', 'never sent'). no_record_found: nothing in the file shows the work, or only an open task does. outcome_not_shown: the action is recorded but its result is not. sources_disagree: documents contradict each other. confirmed_incomplete requires document_states_gap.",
  ),
  gapType: GapType,
  title: z.string(),
  explanation: z.string(),
  priority: Priority,
  operationalImpact: z.string().describe("Why it matters operationally (not legally)"),
  evidence: z.array(EvidenceSchema),
  couldNotEstablish: z
    .string()
    .nullable()
    .describe("What the records do not establish, stated plainly in a neutral voice (no 'I'). null if nothing material."),
  recommendedNextStep: z.string(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const CompletedItemSchema = z.object({
  id: z.string().describe("C1, C2, ..."),
  title: z.string(),
  basis: z
    .enum(["outcome_documented", "action_documented"])
    .describe(
      "outcome_documented: a document shows the intended result was achieved. action_documented: the action itself is evidenced but its outcome is not yet confirmed.",
    ),
  explanation: z.string(),
  evidence: z.array(EvidenceSchema),
});
export type CompletedItem = z.infer<typeof CompletedItemSchema>;

export const OutstandingItemSchema = z.object({
  id: z.string().describe("O1, O2, ..."),
  title: z.string(),
  status: z.enum(["confirmed_outstanding", "status_unknown"]),
  explanation: z.string(),
  relatedFindingIds: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
});
export type OutstandingItem = z.infer<typeof OutstandingItemSchema>;

export const DraftSchema = z.object({
  kind: z.enum(["email", "letter", "call_script", "internal_note"]),
  to: z.string(),
  subject: z.string().nullable(),
  body: z.string().describe("Draft text. Use only facts from the documents; use [brackets] for anything the user must fill in."),
});
export type Draft = z.infer<typeof DraftSchema>;

export const RecoveryActionSchema = z.object({
  id: z.string().describe("A1, A2, ..."),
  order: z.number().describe("1 = do first"),
  action: z.string(),
  rationale: z.string(),
  priority: Priority,
  suggestedOwner: z.string(),
  ownerBasis: z.string().nullable().describe("Why this owner was suggested, or null if it is just the default"),
  requiresApproval: z.boolean(),
  approvalReason: z.string().nullable(),
  relatedFindingIds: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
  draft: DraftSchema.nullable(),
});
export type RecoveryAction = z.infer<typeof RecoveryActionSchema>;

export const TakeoverReportSchema = z.object({
  overview: OverviewSchema,
  timeline: z.array(TimelineEventSchema),
  findings: z.array(FindingSchema),
  completedWork: z.array(CompletedItemSchema),
  outstandingWork: z.array(OutstandingItemSchema),
  recoveryPlan: z.array(RecoveryActionSchema),
  limitations: z.array(z.string()).describe("One item per topic: 'Topic: what is not established, and why (F1)'. Neutral voice, no 'I'. No general legal or case-value disclaimers."),
});
export type TakeoverReport = z.infer<typeof TakeoverReportSchema>;

/** Reasoning call 1 of 2: what happened and what needs attention. */
export const ReportPart1Schema = TakeoverReportSchema.pick({ overview: true, timeline: true, findings: true });
/** Reasoning call 2 of 2: work status and the recovery plan, built on part 1's findings. */
export const ReportPart2Schema = TakeoverReportSchema.pick({ completedWork: true, outstandingWork: true, recoveryPlan: true, limitations: true });
export type ReportPart1 = z.infer<typeof ReportPart1Schema>;

/** Stage 1: per-document extraction. */
export const DocumentAnalysisSchema = z.object({
  docId: z.string(),
  documentType: z.string(),
  documentDate: z.string().nullable().describe("YYYY-MM-DD if stated in the document"),
  author: z.string().nullable(),
  summary: z.string().describe("2-3 sentences"),
  events: z.array(
    z.object({
      date: z.string().nullable().describe("YYYY-MM-DD, or null if undated"),
      description: z.string(),
      quote: z.string().describe("Verbatim supporting excerpt"),
    }),
  ),
  workItems: z.array(
    z.object({
      description: z.string().describe("A request, task, follow-up or deliverable mentioned"),
      statusAsRecorded: z.string().describe("Status exactly as this document records it, e.g. 'Completed', 'pending', 'not included'"),
      quote: z.string(),
    }),
  ),
  referencedEntities: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["provider", "insurer", "person", "document", "other"]),
      quote: z.string(),
    }),
  ),
});
export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>;
