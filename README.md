# Lexroom – contract review

The contract review flow of one law firm's workspace, shared by three lawyers: a list of
documents with the state of their latest review, an AI review that can be requested and
followed live until it completes or fails, and the findings of each review. The AI is the
fake described in the brief.

- `frontend/` – React 19 + Vite + TypeScript, Tailwind, SWR, react-router
- `backend/` – NestJS + TypeORM + SQLite (better-sqlite3), vitest
- `samples/` – the workspace data from the brief (`documents.json`, `lawyers.json`)

## Run

```bash
docker compose up --build
```

Then open **http://localhost:5173**. That is the only address needed: the frontend proxies
`/api/*` to the backend, which is also published on http://localhost:3101 for curl.

Both containers run in watch mode against the mounted sources. The SQLite file lives in
`backend/data/` and is created on first start; the documents are seeded from
`samples/documents.json` when the backend boots. Ports can be changed with
`BACKEND_PORT` and `FRONTEND_PORT`.

After adding or upgrading an npm dependency, renew the containers' `node_modules`
volumes too, otherwise the stale ones are reattached:

```bash
docker compose up --build -V
```

Pick the current lawyer in the header. **Reset application** (also in the header) deletes
every review and finding, so the flow can be replayed from a clean workspace.

### Without Docker

```bash
cd backend  && npm ci --legacy-peer-deps && npm run start:dev   # http://localhost:3000
cd frontend && npm ci && npm run dev                            # http://localhost:5173
```

`--legacy-peer-deps` because `typeorm@1.1.2` still declares `better-sqlite3@^12` as an optional
peer while the project uses `better-sqlite3@13`; the two work together, npm just refuses to
resolve it on its own (the Dockerfile does the same).

Set `VITE_API_PROXY=http://localhost:3000` for the frontend in that case (the default
targets the Docker port 3101).

## Tests

```bash
cd backend
npm test            # unit tests: fake AI, reviews, plan, documents, events
npm run test:e2e    # application boots and answers, in-memory database
npm run lint
```

Or inside the running container: `docker compose exec backend npm test`.

The unit tests run against a real in-memory SQLite, so the rules that live in the database
(one running review per document, monthly count) are tested where they are enforced.
The timing rules (60 s timeout, late findings, slow AI) are tested with fake timers.
There are no frontend tests, see limitations.

## The three points

### 1. The previous review while a new one runs: keep it, and make the new one unmistakable

Both are right, and they do not actually conflict. The previous completed review stays on
screen, open, while the new one runs above it. The new one is impossible to read as final:
it has an "In progress" badge with a spinner, an indigo edge and background, the heading
"New review · 2 findings so far · more may follow", and at the top of its list a pulsing
"Waiting for the next finding…" row. The completed one keeps its "Completed" badge and
green edge. In the documents list, the "Latest review" column shows the newest review's
state, so a document with a review running is marked as such there too.

### 2. Findings before the review has finished: show them, labelled as partial

Every finding is written to the database and pushed to the browser the moment the fake AI
returns it. A lawyer reads the first finding ten seconds in instead of staring at a spinner
for thirty. What the senior partner asks for is a labelling problem, not a reason to hide
information: while the review runs the list grows from the top, each new finding lights up
as it arrives, and the whole block is visibly "in progress". If the review fails, the findings
it had returned are kept and the review is shown as "Failed · Incomplete · failed after 2
findings · not a final result". Nothing partial carries the "Completed" badge.

I also chose to keep partial findings of a failed review rather than discard them. The
findings are real output of the AI about that contract; what failed is the completeness of
the list. Hiding them would make the lawyer pay (in time, not in plan) for the retry twice.

### 3. Requests beyond the plan: refuse, remember, never queue

Here the two cannot both be satisfied, and the customer wins. A queued review that starts
on the 1st of next month is exactly "a review on its way when it won't start for three
weeks". It would also spend one of next month's ten reviews without anyone deciding so at
that moment, which breaks "nobody spends one of our ten reviews without knowing it".

So when the plan is used up the request is refused up front (HTTP 402, a red banner under
the button) and nothing is created. What I kept from the product manager's concern is the
"so nobody has to remember to come back": the refused request is recorded on the document
(`reviewRequestedAt`). That document's row turns orange in the list, with a tooltip, and the
document page shows an orange reminder: the plan had no reviews left when a review was
requested on that date, nothing is queued, remember to run it next month. The reminder
disappears when a review of that document completes. It is a note, not a promise.

The plan is always visible in the header (remaining of 10, with a bar), and a completed
review is the only thing that consumes it.

## How the rules are implemented

- **10 successful reviews per calendar month.** Nothing is counted down. The plan row holds
  only the allowance (10); the usage is the number of reviews with status `completed`
  created since the 1st of the current month (UTC), served by an index on
  `(status, createdAt)`. The allowance therefore renews itself on the 1st with no scheduled
  job, and failed reviews cannot count by construction. The check runs twice: when a review is
  requested (`POST /reviews` refuses with 402 before anything is created) and again when
  it completes, because two reviews started in parallel with one slot left both pass the
  first check. The second check is the completion itself: one `UPDATE … WHERE status =
  'running' AND (SELECT COUNT(*) … this month) < max`, atomic in SQLite, so the second
  review to finish is marked failed instead of becoming an 11th.
- **One review in progress per document.** A partial unique index on `reviews(documentId)
  WHERE status = 'running'`. The service inserts and lets the database decide: a conflict
  becomes 409, there is no check-then-insert race between two lawyers.
- **The fake AI.** `FakeAiProvider` behind an `AiProvider` interface (an async iterable of
  findings that honours an `AbortSignal`). Failure 1 in 5, after 0 to all findings; slow 1
  in 10 (60–120 s instead of 5–30 s); random intervals between findings. Randomness and
  sleep are injectable, so the tests script outcomes exactly.
- **60 seconds.** `POST /reviews` creates the review as `running` and returns 202 at once;
  the work continues in the background and is followed over Server-Sent Events. A timer set
  from the review's `createdAt` aborts the provider's signal at 60 s (a real provider would
  close its connection to the model; the fake clears the timer it sleeps on) and marks the
  review failed. Every status change is `UPDATE … WHERE status = 'running'`, so whichever of
  completion and timeout comes first wins and the other does nothing: a late finding is not
  stored, a late completion does not complete the review and does not touch the plan
  (its `UPDATE` matches no row). The timer lives in the process, so on
  boot every review left `running` by a previous process is marked failed: it could never
  finish, and its row was blocking its document.
- **Live updates.** One SSE stream (`GET /reviews/events`, optionally per document). On each
  event the browser fetches only the affected review or document and patches it into the
  SWR cache; whole lists are refetched only after a reconnect.

### API

| Method | Path | |
|---|---|---|
| GET | `/documents` | documents with their latest review (id, status, who, when, findings count) |
| GET | `/documents/:id` | one document, same shape |
| GET | `/reviews?documentId=` | reviews with findings, newest first |
| GET | `/reviews/:id` | one review with findings |
| POST | `/reviews` `{ documentId, lawyerId }` | 202 running review · 402 plan used up · 409 already running |
| GET | `/reviews/events?documentId=` | Server-Sent Events: `status` and `finding` events |
| GET | `/plan` | `{ max, used, remaining }` for the current month |
| DELETE | `/reviews`, `/findings` | reset (development convenience) |

## Assumptions

- One workspace, three lawyers from `samples/lawyers.json`; the lawyer chosen in the header
  is sent with each request and recorded on the review. `lawyerId` is not validated against
  the file.
- The calendar month is the UTC month, and a review belongs to the month it was requested
  in (its `createdAt`), not the month it completed in.
- The documents come from `samples/documents.json` and are seeded on boot; a superseded
  version of a contract (`supersedes`) is still a document and can still be reviewed.
- An unknown `documentId` results in a failed review (the fake AI has nothing for it) rather
  than a 404 before starting.
- The reset button exists so the reviewer can replay the flow; it is not a product feature.

## Limitations and unfinished work

- **No frontend tests.** The frontend is thin on logic (SWR hooks and presentation), the
  rules are all on the backend, and the four hours went there; but the event hooks that
  patch the cache deserve tests.
- **SQLite with one connection.** Fine for a workspace of three; the design (no
  transactions, each finding and each status change is a single statement) is what keeps
  it fine: with one connection, overlapping transactions would interleave. Postgres would need no code
  change beyond the driver and the `rowid` tie-break in the latest-review query.
- **Plan exhaustion is signalled only on click.** The button is not disabled when the plan
  is used up; the header shows 0 left and the click explains itself (and records the
  reminder). Disabling it would also hide the reminder path.
- **Development mode only.** Docker Compose runs both apps in watch mode against mounted
  sources; there is no production build or image.
- **No pagination, no document upload, no auth, no real AI**, as allowed by the brief.

## Time spent

About 7 hours, over three evenings, against the 4 hours of the brief.

## AI tools

Claude Code (Anthropic, Claude Fable 5.1) in the terminal, for the whole exercise. The
session log is the export in `ai-session-log/`. It ends with the README written; one last
round of changes was made after the export and is therefore not in it: the plan check moved
from a guard into `ReviewsService.start` (a guard should not write to the database), the
completion became a single atomic `UPDATE` instead of a transaction (two overlapping
transactions interleave on SQLite's one connection, which a test caught), and reviews left
`running` by a previous process are now marked failed on boot.

How it was used: I set the architecture and assigned work in small, explicit steps (one
module, one component, one rule at a time), discussing design questions first and asking for
the implementation only once I had decided. Claude wrote the code and the tests for each
step, ran the type checks, linters, tests and boot smoke runs, and reported back; I reviewed
every change, corrected the direction when it drifted (it twice implemented things we were
still discussing, which is why the log has a clear "discuss, then build" rhythm), and set the
conventions (folder layout, hooks and types per component, no logic in leaf components).
The three product decisions, the choice of SSE over polling, the month-count instead of a
counter plus a cron, and the "refuse and remember" position are mine; the arguments for
and against each were worked out in the conversation.
