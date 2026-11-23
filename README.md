# Case Takeover Agent

When a personal injury case changes hands, the new case manager inherits a file they have never seen. This prototype reads that file for them. It works out what has really been done, what hasn't, and what nobody can tell from the records. Then it proposes what to do first, and every statement in its report links to the page it came from.

> Everything in this project is fictional: the firm, clients, providers, insurers, addresses and phone numbers. Every document is marked `[FICTIONAL DEMO RECORD — NOT A REAL CLIENT]`.

---

## The problem

A personal injury case can run for a year or more. For most of that time, the work is done by a **case manager**, not the attorney. The case manager:
- collects medical records and bills from every provider;
- confirms who the insurers are and what coverage they have;
- keeps the client informed;
- tracks each piece of work until the file is ready for the attorney to make a demand.

Case managers leave, go on leave or have their caseloads rebalanced. When that happens, their cases are **reassigned**. The new case manager typically gets:

- a **case management system (CMS)** full of notes, task statuses and scanned documents;
- a **short handover memo**, often written by a supervisor from what the CMS says;
- many other cases needing attention at the same time.

The memo and the CMS describe what *should* have happened. The documents describe what *did* happen, and the two often disagree. Here is what that looks like in one of the sample cases (Sarah Johnson):

- The CMS task for orthopedic records says **"Completed"**. The provider's own letter says it sent only part of the records.
- The handover memo says **treatment is complete**. The client's last call says she is still being treated.
- A CMS note says the insurer **accepted liability**. A later email from the adjuster says the **investigation is still open**.
- The client left a voicemail in **September** asking for an update. By the time the case is reassigned at the end of October, nothing shows anyone called her back.

None of these is visible from the memo. Each would surface weeks later, as a delay, a gap in the medical bills or an unhappy client.

## Why it happens

- **A "Completed" task records that someone ticked a box, not that the outcome happened.** A request can be marked done when it was only sent, and sometimes when it wasn't even sent.
- **Handover memos are summaries of summaries.** They repeat what the CMS says and add what the writer remembers.
- **The evidence is scattered** across intake notes, letters, emails, faxes, call logs and provider lists. The most important problems are often things that are *missing*, and missing things are the hardest to notice.
- **Reading a file properly takes hours.** With many cases arriving at once, the new case manager has to trust the memo and fix problems as they appear.

Small gaps become expensive: unrequested bills, unconfirmed insurance, evidence that was never preserved, a client who feels forgotten.

## What would make it better, ideally

Picture an experienced, careful case manager who reads every page of the file on the first day, before touching anything. They would:

1. **Separate what is proven from what is claimed.** Work counts as "done" only when a document shows the outcome, not just that a task was ticked.
2. **Name what can't be known.** "There is no record of this" is different from "this didn't happen", and both are different from "two records disagree".
3. **Show their sources.** Every statement points to the page that supports it, so anyone can check it in seconds.
4. **Not guess or play lawyer.** Anything that needs legal judgment goes to the attorney, and conflicts are reported rather than quietly resolved.
5. **Turn it into a plan.** That means a prioritised list of next steps, with the letters, emails and call scripts ready to use.
6. **Work inside the firm's systems.** The file is gathered automatically when a case is reassigned, and approved steps become CMS tasks and email drafts. The report updates as new records arrive.
7. **Leave every decision to a person.** Nothing is sent, and no record is changed, without someone's approval.

## What this prototype does

It does points 1 to 5 and 7 today. It shows how point 6 would work.

**It reads the whole file.** That includes PDFs (page by page), text files and **scanned faxes**, which are read with OCR on your own machine.

**It produces a takeover report:**

| Section | What it tells you |
|---|---|
| Overview | Where the case stands, in a few lines, and what needs attention first |
| Timeline | What happened and when, from every document |
| Findings | Problems, each sorted into one of four kinds (below) |
| Completed work | What is done, and whether the *outcome* is documented or only the action |
| Outstanding work | What is still pending |
| Recovery plan | Next steps in order, each with an owner and a draft letter, email, call script or note where useful |
| Open questions & checks | What the records can't establish, and every citation the system checked or removed |

**Each finding is put into one of four plain categories:**

| Category | Meaning | Example |
|---|---|---|
| Confirmed incomplete | A document says the work isn't done | A provider letter: "partial records only" |
| Potentially incomplete | Something looks missing, but no document says so outright | A provider the client mentioned is not on the provider list |
| Unverified | The records can't show whether it was done | No record of a callback after the client's voicemail |
| Conflicting | Two records disagree | The memo says treatment is complete; the client says it isn't |

**Every statement is checked against the documents.** Each finding cites exact words from a specific page. Code, not the AI, then confirms the words really appear there.
- A quote that can't be found is removed.
- A finding left with no supporting quote is withheld, and listed so you can see what was dropped.
- A "confirmed incomplete" finding is kept only if the quote itself says the work isn't done. Otherwise it is downgraded, and the report says so.

Click any citation and the document opens at that page, with the words highlighted.

**It helps you act, without acting for you.**
- **Approve or dismiss** each proposed step, and edit its draft.
- **How to carry this out** shows, for each step, what a connected system would do (create the CMS task, put the email in your Drafts, submit the records request). It also shows what to do by hand today, with the draft or task ready to download or copy.
- **Download tasks (CSV)** exports the whole plan for import into a CMS.
- The **Connections** page explains each integration: what it would automate, what the firm needs to set it up, and what always stays with a person.

**What it will not do:** send anything, contact anyone, change a CMS record, give legal advice, or judge liability or case value.

**What is still missing compared with the ideal:**
- There are no live connections to a CMS, email or document storage, so files are uploaded by hand.
- When new records arrive you re-run the investigation; it doesn't update the report by itself.
- It is single-user, with no sign-in.

---

## Try it

```bash
npm install
npm run dev            # http://localhost:3000
npm run dev:awake      # same, but keeps a Mac awake so a long investigation isn't cut off by sleep
```

Without an API key the app runs in **demo mode**. It shows a prepared example report for the Sarah Johnson case, labelled "Demo mode · prepared example · no AI used" wherever it appears. To run real investigations, add a key and restart:

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=...   (in .env.local, not .env.example: Next.js does not read .env.example)
```

A walk through the app:

1. **Cases** lists eight reassigned cases. Four have case files loaded; four are "Awaiting documents".
2. **Open a case** to see its file. Click any document to read it, or use **+ Add documents** to upload PDFs or text files (several at once). Investigate stays disabled until a case has documents.
3. **Investigate case** shows each step as it runs, with the time remaining.
4. **Open report** shows the report described above. Click any citation to see the source page.
5. In the **Recovery plan**, approve or dismiss steps, edit drafts, and open **How to carry this out**. Decisions are only recorded. Nothing is sent.
6. **Connections** (top bar) explains how each manual step would be automated.

## The sample cases

Each case was written to test something specific. The three test cases have a `TEST-NOTES.md` answer key next to their documents, listing what a good report should and shouldn't say. The agent never sees it. Compare a report against it.

| Case | Documents | What it tests |
|---|---|---|
| **Sarah Johnson**, CW-2026-0187, car accident | 15 | The main demo, with a mix of every kind of problem (listed below). The only case with a prepared demo-mode report |
| **Aisha Thompson**, CW-2025-0911, car accident | 14 | A **clean** file where nearly everything is done. Does the agent avoid inventing problems? |
| **Robert Kim**, CW-2026-0233, dog bite | 14 | A **messy** early-stage file: two different incident dates, an insurer stated as fact but never confirmed, a clinic that closed with a records request marked "Completed" that never went through, missing photos, an undocumented rabies observation |
| **James Whitaker**, CW-2026-0198, commercial truck | 16 | An evidence-preservation letter marked "Completed" that was returned undelivered. The freight broker's insurer mistaken for the trucking company's. A workers' comp lien. A surgery approval the memo says was granted but is still undecided. The ER record is a **scanned fax**, readable only through OCR |
| Four more cases | none | Empty. Open one and upload documents to investigate it |

The Johnson case's planted problems:

- Ortho records request marked "Completed", but the provider released only partial records (confirmed incomplete)
- MRI records task open and never requested (confirmed incomplete)
- Physical therapy and urgent care reported by the client but never added to the provider list (potentially incomplete)
- A separate radiology bill referred to on the ER statement (potentially incomplete)
- Liability "accepted" in a CMS note, but "investigation remains open" in a later adjuster email (conflict)
- Declarations page and liability limits recorded in the CMS but not in the package, and contradicted by the adjuster (conflict, unverifiable document)
- Chiropractic bills recorded as received in June and as never sent in September (conflict)
- Reassignment memo says treatment is complete, but the client says it is ongoing (conflict)
- Client voicemail with no recorded callback (unverified)
- Plus genuinely completed work: police report, ER records and bill, ambulance bill, MedPay paid and exhausted

---

## How it works

The investigation is a fixed sequence of steps controlled by code (`src/lib/agent/engine.ts`), not an open-ended AI agent:

1. **Read.** Every document is read. PDFs are read page by page, so citations can name a page. A page with almost no text (under 25 characters) is treated as scanned and read with OCR (`lib/ocr.ts`, Tesseract, run locally).
2. **Analyse each document** (AI). One call per document lists its dated events, work items with their recorded status, and the people and organisations it mentions, each with an exact quote. Up to 16 documents are analysed at once.
3. **Write the report** (AI, in two calls). Part 1 writes the overview, timeline and findings. Part 2 writes completed and outstanding work, the recovery plan and the open questions, using part 1's findings. It is split because the full report format is too large for a single structured response. The instructions encode the reasoning rules:
   - absence of a record is not proof something didn't happen;
   - a missing document, a missing request and an unconfirmed outcome are different things;
   - conflicts are reported, not resolved;
   - a "Completed" status is not evidence of the outcome;
   - no negligence inferences and no legal conclusions.
4. **Check** (code, no AI). Every quote is matched against the cited document. Matching ignores only differences in case, spacing, dashes and quote marks. Page numbers come from where the match is found, not from the AI. Unmatched quotes are removed, and anything left without evidence is withheld and listed. Then the category rule runs: a "Confirmed incomplete" finding must declare that a document states the gap, and must quote wording such as "not yet requested", "outstanding" or "never sent". Otherwise it is downgraded, and the correction is shown on the finding. The wording list is in `verify.ts` (`GAP_WORDING`).

AI output is validated twice: by the API's structured-output schema and again by Zod before use. A failed validation is retried once with the error, and then the run fails.

**Models.** The engine asks for a *role*, and each role maps to a model:

| Step | Role | Default | Why |
|---|---|---|---|
| Per-document analysis | `extraction` | `claude-haiku-5-5` ($0.10 / $0.50 per 1M tokens) | Simple, high-volume work, and quotes are checked by code anyway |
| Report part 1: overview, timeline, findings | `reasoning` | `claude-opus-5-5` ($4 / $20) | The conflicts and "missing vs. unverified" distinctions depend on this step |
| Report part 2: work status, recovery plan, drafts | `planning` | same as `reasoning` | Builds on part 1's findings |

Settings, all optional, in `.env.local`:

| Variable | Effect |
|---|---|
| `ANTHROPIC_EXTRACTION_MODEL` | Model for per-document analysis |
| `ANTHROPIC_REASONING_MODEL` | Model for report part 1, and part 2 unless set separately |
| `ANTHROPIC_PLANNING_MODEL` | Model for report part 2 only, e.g. `claude-sonnet-5-5` |
| `ANTHROPIC_REASONING_EFFORT` | `low` / `medium` / `high` (default) for both report calls. Lower is faster and cheaper |
| `OCR_ENABLED` | `false` turns off OCR of scanned pages |

**Cost.**
- Opus for part 1 and Sonnet for part 2 cost about $1.30–1.70 per investigation.
- Setting both report models to `claude-haiku-5-5` costs about $0.05–0.10. Quality is lower, but the citation check and the category rule still apply. Use this while testing.
- Cost never appears in the app, which is built for the case manager. Each run's usage is logged to `data/cases/<id>/spend.jsonl`, failed runs included, and `npm run spend` prints it.

**Interrupted runs resume.** Each finished AI step is saved to `data/cases/<id>/checkpoint.json`. If a run fails (network drop, laptop asleep), the next run reuses the saved steps instead of paying for them again. If the browser disconnects, the server finishes the run and saves the report.

**Time remaining** is estimated from this case's last run with the same settings, or from rough defaults until there is one.

## Implemented vs. mocked

| | Status |
|---|---|
| Reading documents (PDF per page, TXT/MD/CSV/EML) and uploading | **Real** |
| OCR of scanned PDFs | **Real, local.** No document is sent anywhere and no AI is used, so it works in demo mode too. OCR pages are labelled in the viewer and flagged to the AI as possibly containing errors. Handwriting and poor faxes read badly. English only |
| AI investigation (Claude via `@anthropic-ai/sdk`) | **Real.** Run live on the Johnson case. Also covered by tests with a mock AI (`tests/engine.test.ts`) |
| Citation checking, page lookup, highlighting | **Real**, in both modes |
| Progress and time remaining | **Real** events. Times are estimates |
| Demo-mode report | **Prepared by hand** for the Johnson case, and checked the same way as an AI report. Labelled everywhere. It also works as a reference answer for comparing AI runs |
| Approve / dismiss / edit drafts | **Real, stored locally.** Approving sends nothing and changes nothing |
| Carrying out actions (`src/lib/integrations.ts`) | **By hand, with files ready.** Simple rules match each step to the systems it would use. Drafts download as .eml or .txt, and tasks as .txt or one CSV. Suggested due dates are 2, 5 or 10 business days by priority |
| Connections to the CMS, email, document storage, records vendors, fax and phone | **Not built.** Explained on the Connections page |
| Sign-in, permissions, multiple users | Not built |

## Commands

```bash
npm test               # unit and end-to-end engine tests (vitest)
npm run typecheck
npm run check:schemas  # confirm the report formats compile on the API (needs a key; well under a cent)
npm run spend          # estimated API spend per investigation, failed runs included
npm run build && npm start
npm run seed:pdfs      # regenerate the sample PDFs (add case ids to rebuild only those)
npm run seed:scanned   # regenerate seed/samples/scanned-pt-intake-fax.pdf (a scanned fax to try uploading)
rm -rf data/           # reset uploads, runs and decisions
```

## Project layout

```
seed/                         sample material (fictional), never modified
  cases.json                  case list
  cases/cw-2026-0187/         Johnson: 15 documents
  cases/cw-2025-0911/         Thompson (clean): 14 documents + TEST-NOTES.md
  cases/cw-2026-0233/         Kim (messy): 14 documents + TEST-NOTES.md
  cases/cw-2026-0198/         Whitaker (truck): 16 documents, one scanned + TEST-NOTES.md
  samples/                    extra files to upload, e.g. a scanned fax
data/                         runtime state (gitignored)
  cases/<id>/uploads/         uploaded documents
  cases/<id>/extracted/       cached text
  cases/<id>/runs/            reports, kept separate from sources
  cases/<id>/decisions.json   approve/dismiss decisions
  cases/<id>/checkpoint.json  finished steps of an interrupted run
  cases/<id>/spend.jsonl      usage per run
src/lib/
  schemas.ts                  report, finding and evidence formats (Zod)
  citations.ts                strict quote matching (server and browser)
  extract.ts, ocr.ts          text extraction and local OCR
  store.ts                    file-based storage
  integrations.ts             connections catalogue; routing actions to systems; drafts and task exports
  llm/                        AI provider interface, Claude implementation, prices
  agent/engine.ts             the investigation pipeline
  agent/prompts.ts            role, reasoning rules, prompts
  agent/verify.ts             citation check and category rule
  agent/eta.ts                time-remaining estimates
  agent/demo-report.ts        the prepared demo report
src/app/                      pages (cases, case, report, connections) and API routes
src/components/               UI: case workspace, report, evidence viewer, recovery plan
scripts/                      sample-file builders, schema check, spend report
tests/                        vitest suites
```
