# Baton — case takeover agent

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

**It helps you act, without acting for you.**
- **Approve or dismiss** each proposed step, and edit its draft.
- **How to carry this out** shows, for each step, what a connected system would do (create the CMS task, put the email in your Drafts, submit the records request). It also shows what to do by hand today, with the draft or task ready to download or copy.
- **Download tasks (CSV)** exports the whole plan for import into a CMS.
- The **Connections** page explains each integration: what it would automate, what the firm needs to set it up, and what always stays with a person.

**What it will not do:** send anything, contact anyone, change a CMS record, give legal advice, or judge liability or case value.

**What is still missing compared with the ideal:**
- There are no live connections to a CMS, email or document storage, so files are uploaded by hand.
- When new records arrive, the case list flags the report as out of date, but you re-run the investigation yourself; it doesn't update the report by itself.
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

1. **Cases** lists fifteen reassigned cases, most urgent first. Ten have case files loaded; five are waiting for documents. Each row has one button for what to do next: **View report** for a case already investigated, **Open to investigate** for one ready to run, and **Add documents** for an empty one.
2. **Open a case** to see its file. Click any document to read it, or use **+ Add documents** to upload PDFs or text files (several at once). Investigate stays disabled until a case has documents.
3. **Investigate case** shows the agent working live: what it is checking and why, and each document it reads, search it makes and item it records, with the time remaining.
4. **Open report** shows the report described above. Click any citation to see the source page. The trail at the top (**All cases / client / Takeover report**) leads back to the case list or the case.
5. In the **Recovery plan**, approve or dismiss steps, edit drafts, and open **How to carry this out**. Decisions are only recorded. Nothing is sent.
6. **Connections** (top bar) explains how each manual step would be automated.

## The sample cases

Each case was written to test something specific. Every case except Johnson has a `TEST-NOTES.md` answer key next to its documents, listing what a good report should and shouldn't say. (Johnson's problems are listed below, and its prepared demo report doubles as a reference answer.) The agent never sees the answer keys. Compare a report against them.

| Case | Documents | What it tests |
|---|---|---|
| **Sarah Johnson**, CW-2026-0187, car accident | 15 | The main demo, with a mix of every kind of problem (listed below). The only case with a prepared demo-mode report |
| **Aisha Thompson**, CW-2025-0911, car accident | 14 | A **clean** file where nearly everything is done. Does the agent avoid inventing problems? |
| **Robert Kim**, CW-2026-0233, dog bite | 14 | A **messy** early-stage file: two different incident dates, an insurer stated as fact but never confirmed, a clinic that closed with a records request marked "Completed" that never went through, missing photos, an undocumented rabies observation |
| **James Whitaker**, CW-2026-0198, commercial truck | 16 | An evidence-preservation letter marked "Completed" that was returned undelivered. The freight broker's insurer mistaken for the trucking company's. A workers' comp lien. A surgery approval the memo says was granted but is still undecided. The ER record is a **scanned fax**, readable only through OCR |
| **Elena Petrova**, CW-2026-0251, hit-and-run pedestrian | 14 | An insurer form the CMS says was sent, but the insurer says it never received (the only copy is unsigned). An ER bill counted twice in the medical totals. Camera footage that was overwritten before anyone asked for it. A memo saying police found the driver when they didn't. A client who needs an interpreter |
| **Maria Gonzalez**, CW-2026-0266, rideshare passenger | 13 | A **medical record that belongs to a different patient** (similar name, different date of birth, an ankle sprain), which the memo says to send to the insurers. The rideshare insurer and the client's trip receipt disagree on whether the ride was still in progress. The memo blames the wrong driver |
| **Daniel Osei**, CW-2025-0874, city sidewalk fall | 15 | A late-stage case. The claim filed with the city gives the **wrong street number**, so the city inspected the wrong spot. The demand lists a bill as $3,150 instead of $3,510. The memo says liability was acknowledged and Medicare resolved; neither is true. The city's inspection letter is a **scanned image**, readable only through OCR |
| **Grace Liu**, CW-2026-0281, grocery store slip (client is 15) | 12 | A **minor client**: the hospital refused the records request because Grace signed her own authorization, yet the memo says the records arrived. A $5,000 insurance payment the memo calls "pending" was already deposited by her mother. Ongoing concussion symptoms against "recovered well". Tests that the agent also **credits work done right**: the store's video really was preserved |
| **Hannah Brooks**, CW-2026-0290, cyclist hit by an opened car door | 13 | **A conflict of interest**: the driver who hit her is a current client of the same firm, the check result was never reviewed, and the memo says "conflicts cleared". The rental car insurer's own 30-day deadline has passed. Coverage is limited, and her own policy has not been looked at |
| **Samuel Adeyemi**, CW-2026-0219, construction site fall | 14 | **A client nobody can reach**: his phone is disconnected and letters come back, but his new address is already in the workers' comp letters. The firm wrote to the wrong scaffold company (a similar name). The memo says the contractor accepted responsibility; its insurer says the opposite. Includes a **scanned OSHA report** |
| Five more cases | none | Empty. Open one and upload documents to investigate it |

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

While it works, the case page shows a **live feed of what the agent is doing**: a short sentence of its own reasoning before each move, then each action. This excerpt is from the Daniel Osei run:

> *The memo says Medicare is resolved and the transcript is on file, but the CMS task list shows an open Medicare item and the document index has no transcript. Next I'll read the remaining documents.*
> …
> *The file has several conflicts so far: the street address, the PT bill amount, Medicare status, and "liability acknowledged." I'll search for every other mention of the key items before recording anything.*
> Search · Searched the file for "transcript" — 4 matches in 4 documents
> Search · Searched the file for "Market Street" — 5 matches in 4 documents
> Search · Searched the file for "3,150" — 1 match in 1 document

Under the feed, a tally keeps count, for example *"15 documents read · 6 searches · 0 quote checks · 51 items recorded"*.

The same trail is kept with the report, under **"How this report was investigated"**, so anyone can see how each conclusion was reached.

**3. Final check.** After the agent finishes, ordinary code checks every quote in the report one more time against the document it cites. Page numbers are taken from where the words were actually found. Anything that still can't be supported is removed and listed under "Open questions & checks", so nothing disappears silently.

### One finding, from start to finish

How the agent handled the wrong-patient record in the Maria Gonzalez case:

- It began with the memo, the CMS notes and the task list. The memo told the new case manager to *"send the urgent care records to the insurers"*.
- It then read the rest of the file, including the urgent care record. The record names *Mariela Gonzales*, born 03/02/1991, and describes an ankle sprain from soccer. The client is *Maria L. Gonzalez*, born 11/23/1988, with neck and shoulder pain.
- Before recording anything, it **searched the file for "Gonzales"**, the other patient's spelling, to check whether that name appeared anywhere else. It appears only on that record.
- It decided: *"The Cedar record names a different patient, which is the most serious issue, so I'll record it first."* It recorded **F1, Conflicting, high priority**, quoting the record, the client information sheet and the provider list. Every quote was checked on the spot and found.
- Its first next step overrides the memo: *"Quarantine the Cedar record (doc-05) and escalate the patient identity mismatch. Do not send it to any insurer or use it in any demand or summary."* Its reason: *"Sending it would disclose another person's health information."* The step is escalated to the supervisor and the attorney, and a later step asks the clinic for the client's correct record.
- On submit, the gate checked that every page had been read and every quote found, and accepted the report.

In the report, clicking the citation opens the urgent care record with the other patient's name highlighted.

### Making it dependable

- **Interrupted runs pick up where they stopped.** The agent's conversation and its draft report are saved after every step. If the connection drops or the laptop sleeps, the next run continues from the last step instead of starting over and paying again. If the browser is closed, the run still finishes and the report is saved.
- **Checked inputs.** Everything the agent sends to a tool is checked against the expected format, first by the API as it is written and then by the app. If it's wrong, nothing happens and the agent is told why.
- **The earlier design is still available.** Setting `INVESTIGATION_METHOD=workflow` in `.env.local` runs the investigation as a fixed sequence of steps instead, so the two can be compared on the same case.

### Models and cost

The agent uses one model throughout. The default is **Claude Opus**, the strongest, and it can be changed in `.env.local`.

- **Haiku (measured):** the sample cases so far cost **$0.03–0.05 per investigation and took 2½–4 minutes**. That makes it practical for testing, and every check above still applies.
- **Opus (estimate, not yet measured):** about $1.50–2.50 per investigation. It should give stronger judgment on difficult files.

The agent re-sends its conversation on every step. That part is cached, which makes it about ten times cheaper. Cost is never shown in the app, which is built for the case manager.

## Results so far

Agent runs on Haiku, compared with each case's answer key:

| Case | Planted problems caught | Notable | Cost | Time |
|---|---|---|---|---|
| Robert Kim | 7 of 8 | Mentioned the unidentified property owner only in passing | $0.04 | 3 min 14 s |
| James Whitaker | 8 of 8 | Linked the returned preservation letter to the second address on the carrier registration | $0.04 | 3 min 24 s |
| Daniel Osei | 6 of 6 | Read the scanned city letter through OCR; searched for the wrong bill figure across the file | $0.03 | 2 min 24 s |
| Maria Gonzalez | 6 of 6 | Put the wrong-patient record first and overrode the memo's instruction to send it | $0.03 | 2 min 49 s |

None of the runs drew a legal conclusion or treated a memo's claim as fact. Two things still need work:
- **Ranking among the high-priority findings.** This has improved since the agent was told to rank by impact, but it needs more runs to confirm.
- **Tool-call slips with smaller models.** One run spent about 40 extra steps re-sending tool calls that Haiku had formatted wrongly. A settings fix brought that back to normal, and the step limit caps the cost if it happens again.

## What is real and what is not

| | Status |
|---|---|
| Reading documents, uploads, local OCR of scanned PDFs | **Real.** OCR works in English only, and handwriting or poor faxes read badly |
| AI investigation by the agent | **Real.** Run live on four sample cases (see "Results so far"), and covered by tests with a scripted model and a stubbed API |
| AI investigation by the fixed workflow | **Real.** Run live on the Johnson and Kim cases. Kept as a fallback |
| Case list: top problem, filters, days without activity, out-of-date report warning | **Real** |
| Citation checking and highlighting | **Real** |
| Demo mode (no API key) | A **hand-written example report** for the Johnson case, checked the same way as an AI report and labelled as an example everywhere |
| Approve / dismiss / edit drafts | **Real, stored locally.** Approving sends nothing and changes nothing |
| "How to carry this out", draft and task downloads, CSV export | **Real.** Each step is matched to the systems it would use by simple rules |
| Connections to the CMS, email, document storage, records vendors, fax and phone | **Not built.** Explained on the Connections page |
| Sign-in, permissions, multiple users | Not built |
