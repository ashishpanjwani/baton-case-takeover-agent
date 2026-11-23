/**
 * What each manual step in the prototype would become with a connection to the
 * firm's systems. Nothing here connects to anything: it describes the connected
 * behaviour and produces the files a person can use by hand today.
 *
 * Product names are examples of systems a firm might use, not partners.
 */
import type { RecoveryAction } from "./schemas";

export type ConnectionId = "cms" | "email" | "documents" | "records" | "phone" | "mail";

export interface Connection {
  id: ConnectionId;
  name: string;
  examples: string;
  /** How the step is done in this prototype. */
  today: string;
  /** What a connection would do. */
  unlocks: string[];
  /** What the firm needs to set one up. */
  needs: string[];
  /** What a person always does, connected or not. */
  staysWithPerson: string[];
}

export const CONNECTIONS: Connection[] = [
  {
    id: "cms",
    name: "Case management system",
    examples: "e.g. Filevine, Clio, Litify, SmartAdvocate, CASEpeer",
    today: "The case export is uploaded by hand, and tasks and notes are copied into the CMS by hand.",
    unlocks: [
      "Start an investigation automatically when a case is reassigned, with no upload",
      "Read the case's notes, task history, contacts and document index directly",
      "Create the recovery-plan tasks, assigned and dated, once you approve them",
      "Post internal notes to the case and notify the attorney or supervisor",
      "Propose record corrections (for example a phone number) as a before/after change for you to approve",
    ],
    needs: [
      "API access from the CMS vendor (most offer one; check your plan)",
      "An administrator to approve the connection and choose which cases it can see",
      "Read access for investigating; write access only if tasks and notes should be created",
    ],
    staysWithPerson: ["Approving every task, note and record change before it is made", "Closing tasks and deciding the case is caught up"],
  },
  {
    id: "documents",
    name: "Document storage",
    examples: "e.g. SharePoint, NetDocuments, iManage, Google Drive, Box",
    today: "Files missing from the review package are searched for by hand and uploaded here.",
    unlocks: [
      "Find files the CMS index lists but the review package left out, and add them before the investigation",
      "Pick up new records as they arrive, so the report can be re-checked",
      "Save approved letters to the case folder",
    ],
    needs: ["Read access to the case folders", "A folder naming rule that links a folder to a case"],
    staysWithPerson: ["Deciding which documents belong to the case when it is unclear"],
  },
  {
    id: "email",
    name: "Email",
    examples: "e.g. Outlook / Microsoft 365, Gmail / Google Workspace",
    today: "Draft emails are copied or downloaded and sent from your own mailbox.",
    unlocks: [
      "Put each approved email in your Drafts folder, addressed and with the subject filled in",
      "Read correspondence filed to the case, so replies (or no reply) are part of the investigation",
      "Log each sent email to the case in the CMS",
    ],
    needs: ["Administrator consent for mailbox access", "A rule for which mail belongs to which case"],
    staysWithPerson: ["Reviewing, editing and pressing Send. The agent never sends email."],
  },
  {
    id: "records",
    name: "Medical records retrieval",
    examples: "e.g. a records retrieval vendor or the providers' release-of-information portals",
    today: "Records and bill requests are written from the draft and sent by fax, mail or email by hand.",
    unlocks: [
      "Submit the records and itemized-bill request with the client's signed authorization",
      "Track each request's status and fees, so “requested” and “received” are recorded automatically",
      "Flag requests with no response after a set number of days",
    ],
    needs: ["An account with the vendor", "The client's signed HIPAA authorization on file"],
    staysWithPerson: ["Approving each request and any fee", "Checking that what arrived is complete"],
  },
  {
    id: "mail",
    name: "Letters, fax and mail",
    examples: "e.g. a document assembly tool with firm letterhead, an e-fax service",
    today: "Draft letters are downloaded, put on letterhead and sent by hand.",
    unlocks: ["Produce the letter on firm letterhead for signature", "Send it by e-fax or mail once signed, and keep the confirmation with the case"],
    needs: ["Firm letterhead templates", "An e-fax or mail account"],
    staysWithPerson: ["Signing the letter", "Approving each send"],
  },
  {
    id: "phone",
    name: "Phone system",
    examples: "e.g. RingCentral, Microsoft Teams Phone",
    today: "Calls are made by hand using the call script, and notes are typed into the CMS.",
    unlocks: ["Call from the case page with the script on screen", "Log the call and your notes to the case automatically"],
    needs: ["A phone system that supports click-to-call and call logging"],
    staysWithPerson: ["Making the call and writing what was said"],
  },
];

export const connectionById = (id: ConnectionId) => CONNECTIONS.find((c) => c.id === id)!;

export interface ManualFile {
  label: string;
  filename: string;
  content: string;
}

export interface ActionStep {
  connection: ConnectionId;
  /** What the connected version would do, phrased for this action. */
  connected: string;
  /** What to do in the prototype today. */
  manual: string;
  file?: ManualFile;
}

/** A request for records or bills, in the same sentence. */
const RECORDS_ASK = /\brelease of information\b|\b(request|follow[- ]up|ask\b[^.]{0,40}\bfor|obtain)\b[^.]{0,80}\b(records?|bills?|billing|itemi[sz]ed|statements?|imaging report)\b|\b(records?|billing)\b[^.]{0,30}\brequest\b/i;
const INSURER = /\b(insur\w*|adjuster|limits|policy|coverage|liability|claim)\b/i;
const PROVIDER_LIST = /\b(add|update)\b.*\bprovider list\b/i;
const RECORD_UPDATE = /\b(update|correct|add)\b.*\b(record|provider list|contact|phone|cms|client information|memo|tracking)\b/i;
const FIND_FILE = /\b(locate|retrieve|search|find|open|check)\b.*\b(cms folder|folder|index(ed)?|review package|declarations page)\b|\bcompare the cms document index\b/i;

export interface ActionContext {
  clientName: string;
  reference: string;
}

/** First sentence of the action, capped, for a task title. */
export function taskTitle(a: RecoveryAction) {
  const first = a.action.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
  return first.length > 100 ? `${first.slice(0, 97).trimEnd()}…` : first;
}

const DUE_DAYS = { high: 2, medium: 5, low: 10 } as const;

/** Suggested due date: business days from `from`, by priority. */
export function suggestedDue(a: RecoveryAction, from: Date) {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  let left = DUE_DAYS[a.priority];
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

const owner = (a: RecoveryAction) => (/incoming case manager/i.test(a.suggestedOwner) ? "You (incoming case manager)" : a.suggestedOwner);

export function taskText(a: RecoveryAction, ctx: ActionContext, from: Date) {
  const lines = [
    `Task: ${taskTitle(a)}`,
    `Case: ${ctx.clientName} (${ctx.reference})`,
    `Assigned to: ${owner(a)}`,
    `Due (suggested): ${suggestedDue(a, from)}`,
    `Priority: ${a.priority}`,
    "",
    a.action,
    "",
    `Why: ${a.rationale}`,
  ];
  if (a.relatedFindingIds.length) lines.push(`Takeover report findings: ${a.relatedFindingIds.join(", ")}`);
  if (a.evidence.length) lines.push("Supporting records:", ...a.evidence.map((e) => `- ${e.docId}: “${e.quote}”`));
  return lines.join("\n");
}

function draftFile(a: RecoveryAction, body: string, ctx: ActionContext): ManualFile | undefined {
  const d = a.draft;
  if (!d) return undefined;
  const slug = `${ctx.reference}-${a.id}`.toLowerCase();
  if (d.kind === "email")
    return {
      label: "Download email (.eml)",
      filename: `${slug}-email.eml`,
      content: [`To: ${d.to}`, `Subject: ${d.subject ?? ""}`, "X-Unsent: 1", "Content-Type: text/plain; charset=utf-8", "", body].join("\r\n"),
    };
  const label = { letter: "Download letter (.txt)", call_script: "Download call script (.txt)", internal_note: "Download note (.txt)" }[d.kind];
  return { label, filename: `${slug}-${d.kind.replace("_", "-")}.txt`, content: [`To: ${d.to}`, d.subject ? `Re: ${d.subject}` : null, "", body].filter((l) => l !== null).join("\n") };
}

/**
 * The steps needed to carry out an action, each shown connected and by hand.
 * `body` is the draft text as the user has edited it.
 */
export function stepsFor(a: RecoveryAction, ctx: ActionContext, body: string, from: Date): ActionStep[] {
  const steps: ActionStep[] = [];
  const text = `${a.action} ${a.draft?.subject ?? ""}`;
  const to = a.draft?.to ?? "";
  const file = draftFile(a, body, ctx);
  const isRecordsRequest =
    RECORDS_ASK.test(text) && !INSURER.test(text) && a.draft?.kind !== "internal_note" && a.draft?.kind !== "call_script";

  if (FIND_FILE.test(a.action))
    steps.push({
      connection: "documents",
      connected: "Search the case folder for the file and add it to the review package, then re-check the findings it affects.",
      manual: "Search the CMS folder by hand. If you find the file, add it to this case with “+ Add documents”.",
    });

  switch (a.draft?.kind) {
    case "email":
      steps.push({
        connection: "email",
        connected: `Save this email to your Drafts folder, addressed to ${to}${a.draft.subject ? `, subject “${a.draft.subject}”` : ""}. You review it and press Send.`,
        manual: "Download the email and open it in your mail app, or copy the text. Fill in anything in [brackets] before sending.",
        file,
      });
      break;
    case "letter":
      steps.push({
        connection: "mail",
        connected: `Produce this letter to ${to} on firm letterhead for your signature, then send it by e-fax or mail once you approve.`,
        manual: "Download the letter, put it on letterhead, sign it and send it by fax or mail.",
        file,
      });
      break;
    case "call_script":
      steps.push({
        connection: "phone",
        connected: `Call ${to} from the case page with this script on screen, and log the call and your notes to the case.`,
        manual: "Make the call using the script, then add a note of the call in the CMS.",
        file,
      });
      break;
    case "internal_note":
      steps.push({
        connection: "cms",
        connected: `Post this note to the case's internal notes and notify ${to}.`,
        manual: "Copy the note into the CMS case notes, or send it to them directly.",
        file,
      });
      break;
  }

  if (isRecordsRequest)
    steps.push({
      connection: "records",
      connected: "Submit the request with the client's signed authorization and track it until the records and bill arrive.",
      manual: "Send the request yourself and set a follow-up reminder in the CMS.",
    });

  if (PROVIDER_LIST.test(a.action) || (!a.draft && RECORD_UPDATE.test(a.action)))
    steps.push({
      connection: "cms",
      connected: "Show the change as before/after in the CMS record. Nothing changes until you approve it.",
      manual: "Make the change in the CMS by hand after confirming it.",
    });

  steps.push({
    connection: "cms",
    connected: `Create this task in the CMS: assigned to ${owner(a)}, due ${suggestedDue(a, from)} (suggested), linked to findings ${a.relatedFindingIds.join(", ") || "none"}.`,
    manual: "Copy the task text into the CMS, or download all tasks as a CSV from the top of the recovery plan.",
    file: { label: "Download task (.txt)", filename: `${ctx.reference}-${a.id}-task.txt`.toLowerCase(), content: taskText(a, ctx, from) },
  });

  return steps;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** All actions as a task list for bulk import into a CMS. */
export function tasksCsv(actions: RecoveryAction[], ctx: ActionContext, from: Date) {
  const head = ["Order", "Title", "Description", "Assigned to", "Due date (suggested)", "Priority", "Requires approval", "Related findings", "Case"];
  const rows = actions.map((a) => [
    String(a.order), taskTitle(a), `${a.action}\n\nWhy: ${a.rationale}`, owner(a), suggestedDue(a, from), a.priority,
    a.requiresApproval ? "Yes" : "No", a.relatedFindingIds.join(" "), `${ctx.clientName} (${ctx.reference})`,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
