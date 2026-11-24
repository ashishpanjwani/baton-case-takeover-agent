# Baton — case takeover agent

When a personal injury case changes hands, the new case manager inherits a file they have never seen. This prototype reads that file for them. It works out what has really been done, what hasn't, and what nobody can tell from the records. Then it proposes what to do first, and every statement in its report links to the page it came from.

**Live URL:** https://baton-xi-eosin.vercel.app/

> Everything in this project is fictional: the firm, clients, providers, insurers, addresses and phone numbers. Every document is marked `[FICTIONAL DEMO RECORD — NOT A REAL CLIENT]`.

**At a glance**
- **For:** case managers at US plaintiff-side personal injury firms who inherit a case from a colleague.
- **What it produces:** a takeover report in which every statement is cited to a page and checked by code. It sorts the work into confirmed incomplete, potentially incomplete, unverified and conflicting, and ends with a prioritised recovery plan with drafts.
- **How:** a tool-using AI agent runs the investigation: it decides what to read, searches the file to follow leads, and builds the report item by item. Deterministic code enforces the rules it can't talk its way around.
- **Status:** a working prototype. Next.js and TypeScript on the Anthropic API, local OCR, 66 automated tests. Deployed on Vercel. Nothing is connected to real firm systems, and it never sends anything.

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

The memo and the CMS describe what *should* have happened. The documents describe what *did* happen, and the two often disagree. A typical example:

- The CMS task for orthopedic records says **"Completed"**. The provider's own letter says it sent only part of the records.
- The handover memo says **treatment is complete**. The client's last call says she is still being treated.
- A CMS note says the insurer **accepted liability**. A later email from the adjuster says the **investigation is still open**.
- The client left a voicemail in **September** asking for an update. By the time the case is reassigned at the end of October, nothing shows anyone called her back.

None of these is visible from the memo. Each would surface weeks later, as a delay, a gap in the medical bills or an unhappy client.

## Why it happens

- **A "Completed" task records that someone ticked a box, not that the outcome happened.** A request can be marked done when it was only sent, and sometimes when it wasn't even sent.
- **Handover memos are written quickly, from the CMS and from memory, not from the documents.** If the CMS is wrong, the memo repeats the mistake. And because it is written with authority, the new case manager has no reason to doubt it.
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

**It shows where to start.** The case list puts the cases that need attention first. For each investigated case it shows the single most important problem the report found, for example *"Cedar urgent care record in file appears to belong to a different patient · 7 high priority"*. Each case also shows how long it has gone without activity, and a warning if documents arrived after its report was made. Filters split the list into investigated cases, cases ready to investigate, and cases still waiting for documents.

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

**It prepares the work, but a person carries it out.** Each step in the recovery plan comes ready to act on, and nothing happens until someone decides:
- **Approve or dismiss.** The case manager records whether they agree with a step, and can edit its draft letter or email first. The decision is stored in the app; nothing is sent.
- **How to carry this out.** A panel on each step lists the systems the step involves (the CMS, email, a records vendor, fax, phone). For each one it shows two things:
  - what would happen with a connection, e.g. "create this task in the CMS, due 11/26" or "put this email in your Drafts folder for you to send";
  - what to do by hand today, with the draft or task text ready to download or copy.
- **Download tasks (CSV).** Exports every step that hasn't been dismissed as a spreadsheet the firm can import into its CMS as tasks.
- The **Connections** page sets out each integration: what it would automate, what the firm would need to set it up, and what always stays with a person.

**What it will not do:** send anything, contact anyone, change a CMS record, give legal advice, or judge liability or case value.

**What is still missing compared with the ideal:**
- There are no live connections to a CMS, email or document storage, so files are uploaded by hand.
- When new records arrive, the case list flags the report as out of date, but you re-run the investigation yourself; it doesn't update the report by itself.
- It is single-user, with no sign-in.

---

## How the investigation runs

The investigation is run by an **AI agent**. Like an experienced case manager on their first day with a file, it decides for itself what to read, what to check and which leads to follow. Code doesn't choose its steps. Code does set the rules it can't get around: every quote is checked, every page must be read, and nothing leaves the firm.

```
 Case file ──▶ 1. Prepare ─▶ 2. The agent investigates ──────────────────────▶ 3. Final check ──▶ Report
              (text+OCR)     │                                         ▲      (every quote)    for review
                             │  reads documents  ·  searches the file  │
                             │  checks quotes  ·  records findings     │
                             │  and next steps  ·  submits the report  │
                             └──── submission refused? fix and retry ──┘
```

**1. Prepare the documents.** Before the agent starts, every file is turned into searchable text, keeping track of the page each line is on. This is mechanical, not reading for meaning: the agent does the reading in stage 2. Scanned pages, such as faxes, are read with OCR on the local machine. Nothing is sent anywhere in this stage.

**2. The agent investigates.** The agent is given the list of documents and a goal: *a takeover report the incoming case manager can rely on*. It has a set of tools, and the choice of which to use, and when, is its own:

| Tool | What it does |
|---|---|
| Read a document | Opens a document, whole or by page |
| Search the case file | Finds every line in every document that mentions a name, number or phrase. This is how it follows a lead |
| Check a quote | Confirms that some exact words really appear in a document before it relies on them |
| Record a finding, timeline event, completed item, outstanding item or next step | Adds the item to the report, with the exact words it rests on, or replaces one |
| Write the overview / the open questions | The summary at the top, and what the records can't settle |
| Withdraw an item | Takes back something the evidence turns out not to support |
| Submit the report | Asks for the report to be accepted |

A typical investigation starts with the documents that say what is *supposed* to be true: the handover memo, CMS notes and task list. It then checks those claims against the source records. When something doesn't add up, it searches the file for every other mention and opens the documents that settle it. It follows these reasoning rules:
- having no record of something doesn't prove it didn't happen;
- a missing document, a request never made and an outcome nobody confirmed are three different problems;
- when two sources disagree, report both and don't pick one;
- a "Completed" status is not proof the work was done;
- no conclusions about fault, negligence or what the case is worth.

And these rules for judging what matters:
- **rank findings by their effect on the case**, so the first finding is the one to understand first. Anything that could undermine the whole claim comes before routine follow-ups, and the most serious problem gets its own next step;
- **statements about fault are facts that can be compared**: if the memo blames one driver and the police report cites another, that is reported as a conflict, without deciding who was at fault;
- **a document that seems to belong to someone else** (a different name, date of birth or address) is flagged as possibly containing another person's private information, kept out of use, and sent to the supervisor and attorney.

**The rules the agent can't get around:**
- **Every quote is checked the moment it is recorded.** If the words aren't in the cited document, the agent is told straight away and has to find the exact wording or withdraw the claim.
- **A submission is refused until the report holds up.** The report is accepted only when:
  - every page of every document has been read;
  - every quote has been found;
  - every high-priority finding has a next step;
  - every "confirmed incomplete" finding quotes a document that itself states the gap.

  Otherwise the agent gets the list of problems and has to fix them.
- **A limit on steps** (60 by default) bounds the time and cost of a run. If it is reached, the report says so.
- **None of the tools can send anything, contact anyone or change a record.** The agent can only read the file and write the report.

While it works, the case page shows a **live feed of what the agent is doing**: a short sentence of its own reasoning before each move (*"The memo says the truck data is protected — checking whether the preservation letter actually arrived"*), then each action it takes.

The same trail is kept with the report, under **"How this report was investigated"**, so anyone can see how each conclusion was reached.

**3. Final check.** After the agent finishes, ordinary code checks every quote in the report one more time against the document it cites. Page numbers are taken from where the words were actually found. Anything that still can't be supported is removed and listed under "Open questions & checks", so nothing disappears silently.

### Under the hood

The agent works in **rounds**:

```
 ┌─────────────────────────── one round ───────────────────────────┐
 │  MODEL   thinks  →  writes one line for the feed  →  asks for    │
 │          one or more tools (e.g. "read these 5 documents")       │
 │                              │                                   │
 │                              ▼                                   │
 │  APP     checks each request  →  runs the tool  →  sends back    │
 │          plain feedback ("quote 2 NOT FOUND in doc-07")          │
 └──────────────────────────────────────────────────────────────────┘
        repeats until the report is accepted, or 60 rounds pass
```

| Part | How it works |
|---|---|
| **What the model starts with** | The case details, today's date and a **list** of the documents: titles, page counts, which pages are scans. Not the text itself: it opens each document when it chooses to. |
| **Where the report lives** | In a draft held by the app. Each "record" call adds or replaces one item, checked on arrival. The app assigns the ids (F1, A1…). |
| **Feedback** | Short and specific, so the model can fix itself: a quote not found, a category that doesn't hold, or the list of problems blocking submission. |
| **Quote check** | Exact match after ignoring differences in case, spacing, quote marks and dashes. The page number comes from where the words were found, never from the model. The same check runs on record, on submit and in the final check. |
| **Category rule** | "Confirmed incomplete" needs a quote that itself states the gap ("not yet requested", "never sent"). Otherwise it is downgraded, and the report says so. |
| **Edge cases** | No tool call: nudged to continue. A tool call cut off mid-way: never run. 8 rounds left: told to wrap up. 4 refused submissions: accepted, and the final check removes anything unsupported. |
| **Resuming** | The conversation and draft are saved after every round, so an interrupted run continues where it stopped. Closing the browser doesn't stop a run. |
| **Cost** | The conversation is cached between rounds, which is about 10× cheaper. Default model: Claude Opus. Claude Haiku costs a few cents a run. Cost is logged, never shown in the app. |
| **Documents** | PDFs are read page by page. Pages with almost no text are treated as scans and read by OCR (Tesseract) on the local machine. |
| **Fallback** | The model sits behind a provider interface. `INVESTIGATION_METHOD=workflow` runs the earlier fixed-step version instead. |
| **Stack** | Next.js 16, React 19, TypeScript, Tailwind, Zod 4, the Anthropic SDK, pdf.js, tesseract.js. The tests use a scripted fake agent and a stubbed API, so they need no key and cost nothing. |

---

## Try it

**Online:** [baton-xi-eosin.vercel.app](https://baton-xi-eosin.vercel.app/). Open any case marked "View report", or investigate one marked "Open to investigate".

**Locally:**

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

1. **Cases** lists fifteen reassigned cases, most urgent first. Ten have case files loaded; five are waiting for documents. Each row has one button for what to do next: **View report** for a case already investigated, **Open to investigate** for one ready to run, and **Add documents** for an empty one.
2. **Open a case** to see its file. Click any document to read it, or use **+ Add documents** to upload PDFs or text files (several at once). Investigate stays disabled until a case has documents.
3. **Investigate case** shows the agent working live: what it is checking and why, and each document it reads, search it makes and item it records, with the time remaining.
4. **Open report** shows the report described above. Click any citation to see the source page. The trail at the top (**All cases / client / Takeover report**) leads back to the case list or the case.
5. In the **Recovery plan**, approve or dismiss steps, edit drafts, and open **How to carry this out**. Decisions are only recorded. Nothing is sent.
6. **Connections** (top bar) explains how each manual step would be automated.

## Design decisions

- **An agent, but with guard rails written in code.** The value of this job is in following leads: a returned letter leads to a second address, a "Completed" task to the letter that contradicts it. Fixed steps can't do that well, so the model decides what to look at. What it may *not* decide is whether the report holds up. Reading every page, finding every quote and the category rule are checked by code, not requested in a prompt.
- **Citations are checked by code, not by a second AI.** An AI asked to check an AI can agree with a mistake. An exact text match can't. The cost is strictness: the agent must quote exactly, and when it doesn't, it is told and fixes it.
- **"Absence is not proof" is built into the categories.** The most common error in reviewing a file is treating a missing record as missing work. The four categories, plus the rule that "confirmed incomplete" needs a document that *states* the gap, keep "we can't find it" separate from "it wasn't done".
- **No legal judgment, by design.** The agent compares what records say, including what they say about fault, and routes anything needing judgment to the attorney. It never decides fault, coverage, deadlines' legal effect or case value.
- **Nothing leaves without a person.** The tools can only read the file and write the report. Drafts and integrations are previews; a person sends everything.
- **Documents stay local where possible.** OCR runs on the machine. Only the text the agent reads goes to the model API.
- **The checks don't depend on the model.** A cheaper model can be used to iterate quickly; it produces a thinner report, not a less honest one, because the same code checks every quote and enforces the same rules.

## What's next

- **Automated evaluation.** Score reports against test cases with known, planted problems, so every change to the agent's instructions is measured rather than judged by eye.
- **Compare models.** Put a number on the quality difference between Opus and cheaper models against their cost.
- **Bigger, messier files.** The test files so far are small enough to read in full. Real files run to hundreds of pages, which is where search and selective reading start to matter, and where context limits need a strategy.
- **Real connections,** starting with read access to one CMS. That removes the manual upload and lets a report be re-checked when new documents arrive.
- **Multiple users,** with sign-in and a record of who approved what.

## What is real and what is not

| | Status |
|---|---|
| Reading documents, uploads, local OCR of scanned PDFs | **Real.** OCR works in English only, and handwriting or poor faxes read badly |
| AI investigation by the agent | **Real.** Run live, and covered by tests with a scripted model and a stubbed API |
| AI investigation by the fixed workflow | **Real.** Kept as a fallback |
| Case list: top problem, filters, days without activity, out-of-date report warning | **Real** |
| Citation checking and highlighting | **Real** |
| Demo mode (no API key) | A **hand-written example report** for the Johnson case, checked the same way as an AI report and labelled as an example everywhere |
| Approve / dismiss / edit drafts | **Real, stored locally.** Approving sends nothing and changes nothing |
| "How to carry this out", draft and task downloads, CSV export | **Real.** Each step is matched to the systems it would use by simple rules |
| Connections to the CMS, email, document storage, records vendors, fax and phone | **Not built.** Explained on the Connections page |
| Sign-in, permissions, multiple users | Not built |
