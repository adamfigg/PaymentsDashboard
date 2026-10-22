# NOTES

Working notes for the transactions dashboard assessment. I'm writing these as I go,
so earlier sections show what I knew at that point. Decisions are explained in the
sections for each task.

## 0. Baseline: what I found before changing anything

### Getting it running
- `npm install` succeeded on Node 24 (`.nvmrc` pins 22). It reported **31 audit
  findings**, 11 of them in production deps. The serious ones are in the API's pinned
  `express@4.17.1` (body-parser, path-to-regexp, qs, send, proxy-addr: critical) and
  `lodash@4.17.15` (prototype pollution).
- **Gotcha:** the API reads a generic `PORT` env var ([config.ts](apps/api/src/config.ts)).
  My launcher sets `PORT=3000` for the web app, so the API also tried port 3000, the
  Vite proxy to `:4000` got `ECONNREFUSED`, and the UI showed a **spinner forever**.
  Two problems are hiding in that:
  1. The API should use its own variable (e.g. `API_PORT`), and the proxy target should
     come from the same place.
  2. `useTransactions` has no error handling (`.then` with no `.catch`, `loading` never
     cleared), so any failed API call leaves a spinner that never stops instead of an
     error message.

### Architecture in one paragraph
Express API (`apps/api`) loads `transactions.json` (10,000 rows) into memory and
exposes `GET /api/transactions` (everything), `GET /api/transactions/summary`,
`GET /api/transactions/:id` and `POST /api/transactions`. The React 19 + antd app
(`apps/web`) fetches **all** transactions once, then filters, totals, and renders them
on the client. The summary endpoint exists but the UI never calls it. The web and API
packages each define their own copy of the `Transaction` model.

### Measured baseline
| Metric | Value |
| --- | --- |
| `GET /api/transactions` payload | ~2 MB, 10,000 rows, one response |
| DOM nodes with full list rendered | ~94,000 |
| Keystroke → list updated, clearing search (10k rows) | ~2.1–2.4 s |
| Keystroke, "b" (3,441 rows) | ~0.9 s |
| Keystroke, "bl" (488 rows) | ~0.16 s |
| "Total processed" shown | $25,438,084.33 |
| `/summary` `totalVolume` | 25,438,084.33 (the same, and wrong in the same way, see Task 2) |

(Timings were taken in a background browser tab, so treat them as relative, not
absolute. The shape is what matters: cost scales with rows rendered.)

### Data profile (`transactions.json`)
- 10,000 rows, all IDs unique, `amount + surcharge === total` on every row, no nulls.
- Status split is roughly 25% each: APPROVED 2,446 / PENDING 2,474 / REFUNDED 2,523 /
  DECLINED 2,556, **plus one `VOIDED` row** that isn't in the `TransactionStatus`
  enum. `statusTagColor` has no default case, so that row gets `undefined` as its color.
  The types claim something the data doesn't honor, so the API boundary needs runtime
  validation.
- Adding up `amount` as floats gives `25438084.33000013`. Accumulating money in floats
  drifts, so totals should be summed in integer cents.

### Issues spotted on the first read (to triage into the tasks / Task 5)
**Correctness**
- Summary total: sums `amount` (not `total`), includes declined and refunded rows,
  float accumulation, and is computed client-side over the *filtered* list.
  Details in Task 2.
- New transaction form: `parseInt(amount)` drops cents ("12.99" → 12) and turns ""
  into `NaN`. No validation on either side. The server sets the surcharge to 0 and
  builds the ID from `length + 1`.
- Dates: `2026-06-29T00:00:00Z` renders as **6/28/2026** in US time zones. `formatDate`
  converts the UTC instant to local time, so every date is a day early for anyone
  west of UTC.
- `TransactionList` uses the array index as the React `key`, which breaks once the
  list is filtered or paginated.

**Security / production readiness**
- A live-looking processor API key and webhook secret are **hard-coded** in
  `apps/api/src/config.ts` and committed.
- The error handler returns `err.stack` to clients.
- CORS is `origin: "*"` with `credentials: true`.
- No authentication or authorization on any endpoint, including `POST`.
- Outdated dependencies with known CVEs (above).

**Performance / UX**
- Full dataset over the wire, filtered on every keystroke with no debounce, all
  rows rendered (no pagination or virtualization).
- A `console.log` on every render (and on every API request server-side).
- Rows are clickable `div`s: no keyboard access or row semantics (a11y).

**DX / quality**
- No tests at all, even though both packages have `vitest` installed.
- The `Transaction` model is duplicated in web and API and will drift.

### Work plan
Ordered so each step either sets something up for the next one or is a cheap, high-value
fix. One commit per step (more for Task 1). Unchecked items at the end become
"with more time" notes rather than half-finished code.

**Step 0: Dev setup fix**
- [x] Rename `PORT` → `API_PORT` so the API stops colliding with tools that set `PORT`
      (the cause of the endless spinner in the baseline).

**Deferred: hard-coded secrets in `config.ts`.** Noted, not fixed for now. Covered in
Task 5 / ship-no-ship instead. If I come back to it: rotate the keys first (they're in
a public repo's history), then read them from `process.env` with a fail-fast helper,
load `.env` locally via Node's `--env-file-if-exists`, and add fake placeholders to
`.env.example`.

**Step 1: Task 2, summary total** (small, and defines "processed" before Task 1 moves it)
- something I noticed about the total processed amout that we are showing in the main dashboard, what is the defenition of processed? This is something that I would meet with product managers to determine what the actual definition of this term should be. For my changes I will call processed as approved transations and include the surcharge amount as well.
- there is also a rounding error on the cents shown where cents gets rounded incorrectly leading to a numerical error. IE amount shown could be 6,299,522.48 vs 6,299,522.49
  - make the sum in integer cents, not floats.
- add unit tests for checking to total amount shown in summary the summary.

**Step 2: Task 1, pagination + search** (biggest design piece)
- server-side search over merchant, id, card, status. The summary takes the same
      filter so the numbers match what's on screen.
- debounce the search, keep the page and search in the URL, added filters to some of the columns for user experience.
- Loading / empty / error states (fixes the endless spinner) and
      remove the render `console.log`.

**Step 3: Task 3, New Transaction form**
- added additions to the new transaction page
  - added fields that could be added so each part of the table is represented
  - added validation and warning for high percentage
  - added surcharge calculation so that the amount or the precent could be changed for ease of use
  - toast messaging for success or failure

**Step 4: Task 4, detail page**
- [ ] `/transactions/:id` route with loading / not-found (404) / error states.
- [ ] Navigate from the list rows (real links, so they're keyboard and
      middle-click friendly); decide whether the modal stays or goes.
- [ ] Redirect to the new transaction's detail page after creating it.

**Step 5: Small correctness fixes found along the way**
- [ ] `formatDate` shows UTC dates a day early → format with `timeZone: "UTC"`.
- [ ] Handle the unknown `VOIDED` status (enum + default case in `statusTagColor`).

**Step 6: Write-up**
- [ ] Task 5 (3–5 improvements), the three questions, "with more time".
- [ ] Final pass: `npm run lint`, `npm run build`, `npm test`.

---

## Step 0: Dev setup fix (`PORT` → `API_PORT`)

**Problem.** The API read the generic `PORT` env var. Tooling that sets `PORT` for the
web dev server made the API bind the same port, so the Vite proxy got
`ECONNREFUSED` and the UI showed a spinner forever.

**Fix.** The API listens on `API_PORT` (default 4000), and the Vite proxy reads the same
variable, so the two can't drift apart. The API scripts also pass Node's built-in
`--env-file-if-exists=.env`, so the "copy to .env for local overrides" note in
`.env.example` actually does something now (before, nothing loaded `.env`). No new
dependency, and a fresh clone still runs with zero setup.

**Verified:** with `PORT=3000 API_PORT=4100` the API listens on 4100; with only a
`.env` containing `API_PORT=4101` it listens on 4101; the dashboard still loads
through the proxy.

---

## 1. Task 1: Pagination and search

### Plan (written before coding)

**The split: the server owns the data operations (search, sort, paginate, summarize).
The client owns the interaction (input, timing, URL state, loading/error/empty states).**
Once the client only holds one page, it *can't* search or total the full dataset
correctly. Client-side search would only search the current page, and a client-side
total would only total the current page (the Task 2 bug again). Putting the data
operations on the server also means the same contract keeps working when the data
moves to a real database.

**API contract**
```
GET /api/transactions?page=1&pageSize=25&q=blue
→ { data: Transaction[], page, pageSize, total, totalPages }

GET /api/transactions/summary?q=blue
→ { count, processedTotal }
```
- **Offset (page-number) pagination.** The dataset is in memory and a numbered pager
  allows jumping to any page. At 10M rows I'd switch to keyset/cursor pagination
  (see question 2).
- **Validation:** `page` is an integer ≥ 1; `pageSize` defaults to 25 and is capped at
  100; `q` is trimmed and at most 100 chars. Non-numeric values → `400`. A page past
  the end → empty `data` with the real `total`, so the client can recover.
- **Search semantics unchanged:** case-insensitive substring over merchant, id, card
  brand and status. I'm moving *where* it runs, not changing *what* it matches.
- **Stable sort:** `createdAt` desc, then `id` desc. Every timestamp in the data is
  midnight (~55 rows per date), so without a tiebreaker rows could move between pages
  from one request to the next.
- **The summary uses the same filter function as the list,** so the numbers always
  match what's shown. The Task 2 "processed" logic and its tests move to the server.
  It's a separate endpoint because at scale counts and aggregates are the expensive
  part, and you want to cache or degrade them separately from fetching rows. The
  client fetches both in parallel.

**Client**
- Search input updates instantly. Requests are **debounced (~300 ms)**, and a new
  search resets to page 1.
- **Page and search live in the URL** (`?q=blue&page=3`): refresh, back/forward and
  shared links work, and Task 4's detail page can return to the same page.
- **Stale responses can't win:** each request aborts the previous one
  (`AbortController`), so a slow "bl" response can't overwrite "blu".
- **States:** spinner only on first load; keep the current rows (dimmed) while the
  next page loads; **error with Retry** (fixes the endless spinner); empty state
  ("No transactions match …").
- antd `Pagination` with "1–25 of 3,441" and a page-size picker (10/25/50/100).
- `key={t.id}` instead of the array index; remove the per-render `console.log`.

**Steps (one commit each)**
| Step | What | Verified by |
| --- | --- | --- |
| A | API: list endpoint with search, sort, pagination and validation | Unit tests: bounds, search, stable sort, bad input |
| B | API: `/summary?q=` with the Task 2 logic moved to the server | Tests moved from web |
| C | Client: service + hook, pagination UI, loading/error/empty states | Running app |
| D | Client: debounce, URL state, request cancellation | Running app, keystroke latency vs the 2.1 s baseline |
| E | Write-up here + questions 1 and 2 | |

**Deliberately out of scope (written up instead):** structured filters (e.g. a status
dropdown); list virtualization (not needed at 25 rows/page); 10M-row concerns (DB
indexes, keyset pagination, a text-search index, approximate or cached counts,
pre-aggregated totals). Changing the response shape from `{ transactions }` to
`{ data, … }` is safe here because nothing else consumes it. For a public API I'd
version it or keep the old shape during a deprecation window.

### Progress
_Updated as each step lands._

**Step A: API list endpoint (done).**
- `GET /api/transactions` now returns `{ data, page, pageSize, total, totalPages }`.
- Query parsing and validation live in `apps/api/src/http/list-query.ts`, a pure function
  that's easy to test. All errors come back at once as a `400` with `details`.
- `transaction-service.ts` gains `list()`, a shared `matchesSearch` (step B reuses it
  for the summary), and a `compareNewestFirst` sort with an id tiebreak. The store is
  sorted once at startup, not on every request.
- The service now takes optional seed data, so tests use small fixtures instead of
  the 10k-row file.
- Tests (26): defaults, trimming, page-size capping, rejected values (`0`, `-1`,
  `1.5`, `abc`, `1e3`, repeated params, over-long search), sort with ties, pages being
  disjoint and complete, past-the-end page, search on each field, search before
  pagination, no matches, no mutation of the seed, new rows landing on page 1.
- Verified live: the default response went from **~2 MB to ~5 KB**; `/:id` and
  `/summary` are unaffected.
- **Interim state:** the client reads `body.data`, so it shows only the first 25 rows,
  and the summary totals only those rows ("25 / $16,739.68"). That's exactly the bug
  step B prevents. Each commit still runs.

**Step B: server-side summary (done).**
- `GET /api/transactions/summary?q=` now returns `{ count, processedTotal }`.
  - `count` is the rows matching the search, any status. It always equals the list's
    `total`.
  - `processedTotal` is the Task 2 definition (APPROVED only, `total` including
    surcharge), summed in integer cents (`apps/api/src/utils/money.ts`).
- The summary uses the same `matchesSearch` as the list, and its `q` is parsed by the
  same rules (`parseSummaryQuery` shares the `q` validation with `parseListQuery`), so
  a search can't mean different things on the two endpoints.
- I dropped the old `totalVolume`/`totalSurcharge` fields. Nothing consumed them, and
  `totalVolume` was the wrong "all statuses" figure.
- Side effect: the API code no longer uses `lodash`, which has known
  prototype-pollution CVEs at the pinned 4.17.15. The dependency can now be removed
  from `package.json`. I left that for a separate change.
- Tests (+9): the Task 2 cases on the server (approved-only, surcharge included,
  `0.7 + 0.1` drift, 10k-row exactness), the search filter applied with
  `count === list.total`, no matches, and the parser rules for `q`.
- Verified live: no search → $6,488,615.40 and AMEX → $1,609,877.65, the same figures
  the Task 2 UI fix showed; `count` equals `list.total` for every term I tried.
- The client still computes its own total (over the 25 rows it holds) until step C
  switches it to this endpoint and deletes `computeProcessedTotal` from the web app.

**Step C: client pagination and page states (done).**
- **Service** (`services/transaction-service.ts`): typed `TransactionPage` /
  `TransactionSummary` and URL builders. `getJson` throws an `ApiError` on non-2xx,
  because `fetch` only rejects on network failure; before this, a 500 would have been
  parsed as if it were data.
- **`useFetch(url)`**: one small hook. The URL is the whole cache key (page + size +
  search), so any change refetches. It keeps the last good `data` while the next
  request loads, exposes `error` and `retry`, and aborts the previous request on
  change. That last part means a slow response for an old search can't overwrite a
  newer one. I pulled the abort forward from step D because it's two lines and is
  about correctness, not polish.
- **List and summary are separate requests** (`useTransactions`,
  `useTransactionSummary`). Paging doesn't refetch the summary, since it only depends
  on the search.
- **States in `TransactionsPage`:**
  - first load → spinner
  - failed with nothing on screen → error alert with **Retry** (this replaces the
    old endless spinner)
  - failed with rows on screen → warning banner + Retry, keeping the stale rows
    rather than blanking the page
  - loading the next page → current rows dimmed under a spinner
  - no results → `Empty` with "No transactions match "…""
  - page past the end → jump to the last real page
- **Pagination:** antd `Pagination` with "26–50 of 10,000" and 10/25/50/100 per page.
  A new search or page size resets to page 1. Changing page scrolls to the top.
- **SummaryBar** now shows the server's `count` / `processedTotal`, so it covers the
  whole search result, not just the visible page. I removed `computeProcessedTotal`
  from the web app (its tests moved to the API in step B) and kept the
  `formatCurrency` rounding test.
- Small fixes: `key={t.id}` instead of the array index, removed the per-render
  `console.log`, added an `aria-label` on the search input.
- **Verified in the running app:**
  - initial load: 25 rows, "1–25 of 10,000", $6,488,615.40
  - page 2: "26–50"
  - from page 3, switching to 50/page → "1–50", page 1
  - search "blue": back to page 1, "1–25 of 488", $275,941.92
  - "zzz": empty state, no pager, $0.00
  - simulated 500 while on a page: warning banner, the 50 rows stay; Retry recovers
  - simulated network failure on a fresh mount: error alert; Retry recovers
- **Still to do in step D:**
  - every keystroke fires a request (no debounce yet)
  - page and search reset when you navigate away and back (not in the URL yet)

**Step D: debounce + URL state (done).**
- **The URL is the source of truth** for what's fetched: `?q=blue&page=3&pageSize=50`
  (`hooks/useListParams.ts`). Defaults are left out, so the plain dashboard stays `/`.
  Malformed values in a hand-edited URL (`page=abc`, `pageSize=7`) fall back to
  the defaults instead of erroring.
- **Debounce** (`hooks/useDebouncedValue.ts`, 300 ms). The input has its own state, so
  typing stays instant, and only the settled value is written to the URL, so only it
  reaches the API. Clearing the box and pressing Enter skip the wait, since those are
  deliberate actions.
- **Two-way sync without loops.** A `syncedQ` ref records the last search the input
  and URL agreed on, so the page can tell its own URL writes apart from outside ones
  (Back/Forward, a pasted link). An outside change updates the input. Our own writes
  don't overwrite what the user is still typing.
- **History design** (a bug I caught while testing). My first version used `replace`
  for every search. That replaced the unsearched dashboard's own entry, so Back
  skipped straight past it out of the app. Now:
  - starting or clearing a search **pushes** a history entry
  - refining a search ("blu" → "blue") **replaces** it, so there's no Back step per word
  - paging **pushes**, so Back returns to the previous page
- **Verified in the running app:**
  - typing "b", "bl", "blu", "blue" → **one** list request + one summary request, for "blue"
  - first search adds 1 history entry; refining adds 0; paging adds 1
  - Back → page 1 → unsearched dashboard, with the input following along; Forward
    restores it
  - opening `/?q=amex&page=2&pageSize=50` restores the input, page 2, 50/page and the
    AMEX summary, and the debounce doesn't reset the page afterwards
  - `page=999` corrects to the last page (`page=20`)
  - clear → full results in ~80 ms

**Re-measured against the baseline** (same method: dispatch input, flush React's
render, force layout; both runs in a background tab, so compare ratios, not absolutes):

| Metric | Baseline | After Task 1 |
| --- | --- | --- |
| Initial payload | ~2 MB (all 10k rows) | ~5 KB (25 rows) + summary |
| DOM nodes | ~94,000 | ~380 |
| Keystroke render cost | 0.9–2.4 s | **30–51 ms** (~50× less) |
| Requests while typing "blue" | 0 (but filtering all 10k rows every keystroke) | 2, once typing pauses |
| Server time per request | — | 5–7 ms |
| Last keystroke → new rows | ~0.9 s ("b") | ~470 ms, of which 300 ms is the deliberate debounce |

Checks: all tests pass, both apps typecheck, `npm run build` succeeds, and lint shows
only the two existing row-click a11y warnings (Task 4 replaces those rows with links).

**Extension: sortable columns.** Click any column header to sort by it, and click
again to flip the direction.
- **Sorting is on the server, for the same reason as search.** With pagination the
  client holds 25 rows, so sorting them locally would only reorder the current page.
  "Highest amount" has to mean highest across the whole result.
- **API:** `GET /api/transactions?sort=amount&order=desc`.
  - `sort` is whitelisted against `SORT_FIELDS` (every column in the table) because it
    becomes a property key on the server: `?sort=__proto__` or an unknown field is a
    `400` listing the valid values, not a silently odd sort.
  - The default stays `createdAt desc`.
  - The sort applies after the search and before paging. The summary is unaffected,
    since ordering doesn't change which rows match.
- **One comparator for every column** (`comparator(sort, order)`): numbers compare
  numerically, text with an `Intl.Collator` (case-insensitive, so "bravo" sorts
  next to "Bravo").
- **id is always the tiebreak, in the same direction.** This matters even more than
  for dates: there are only four card brands and four statuses, so without it
  thousands of tied rows could move between pages from one request to the next.
- **Cost:** the store stays sorted in the default order. Any other order sorts a copy
  of the matching rows per request, a few ms at 10k rows. At scale that's an
  `ORDER BY` on an indexed column (see question 2).
- **First-click direction depends on the column:** numbers and dates go highest/newest
  first (what you usually want to see: "biggest transactions"); text goes A→Z.
  Clicking the active column flips it.
- **Sort lives in the URL** alongside the search and page (left out when it's the
  default). A sort change resets to page 1 and pushes history, so Back undoes it.
- **Accessibility:** headers are real `<button>`s (keyboard and screen-reader
  operable), the table has `table`/`row`/`columnheader`/`cell` roles, the active
  column has `aria-sort`, and arrows show direction. Adding table roles made lint
  flag the clickable rows as unreachable by keyboard (the original warning, now
  stricter), so rows are now focusable and open with Enter/Space. **Lint is fully
  clean for the first time**, including the two warnings that were there at the
  start.
- **Tests (+14):** numeric desc with ties, asc is the exact reverse, case-insensitive
  text, stable across pages with heavy ties, sort before paginate, sort within a
  search, store not mutated, plus parser cases (valid, default, `__proto__` /
  `constructor` / unknown / wrong-case field, bad order).
- **Verified in the running app** against an independent sort of the raw data:
  - Amount, first click: `txn_003691 $4,998.93` first
  - Amount, second click: `txn_009401 $100.13` first
  - Merchant: A→Z
  - sorting from page 3 resets to page 1
  - Back undoes the sort
  - `?q=blue&sort=total&order=desc` opened directly: `txn_007494 $5,141.18` first;
    walking all 20 pages gives 488 rows, 488 unique, in non-increasing order
  - keyboard Enter on a header sorts it and keeps focus

**Extension: Card / Status filters and "Clear filters".**
- **The Card and Status headers open a checklist instead of sorting.** With four card
  brands and five statuses, "show me only VISA and AMEX" is far more useful than
  sorting them alphabetically, and one click can't do both. The other six columns
  still sort.
- Ticking a box applies straight away (table and summary update while the popover
  stays open). None ticked means no filter. A badge shows how many values are
  selected, the popover says "2 of 4", and **Reset** clears that one column.
  Selecting every value is *not* collapsed to "no filter": that would make the last
  box you tick visibly un-tick all of them, and the rows are the same either way.
- **API:** `?cardBrand=VISA,AMEX&status=APPROVED,PENDING` on both `/transactions` and
  `/summary`, parsed by one shared `parseFilters`. OR within a column, AND across
  columns and with the search (`matchesFilters`). Unknown values are a `400` that
  names the bad value, not silently ignored, since a typo would otherwise look like a
  filter that matches nothing. On the client, junk in a hand-edited URL is dropped
  instead.
- **The summary takes the same filters**, so "Transactions" and "Total processed"
  always describe exactly the rows in the table. Filtering to DECLINED gives a
  processed total of $0.00, which is correct.
- **`VOIDED`:** one row in the data has a status that wasn't in either enum. I added
  it to both enums (so it's filterable) and gave `statusTagColor` a `VOIDED` case
  plus a `default`, so an unknown future status renders plainly instead of passing
  `undefined` as a colour. This closes the VOIDED item from my first-read list.
- **History** follows the same rule as search: the first selection on a column
  pushes an entry, and further ticks on it replace it (two ticks = one Back step).
- **"Clear filters"** (header, next to the search) resets *everything* to how the
  dashboard loads: search, both filters, sort, page and page size, giving the plain
  `/` URL. It's disabled when there's nothing to clear. It pushes history, so Back
  brings the cleared view straight back. The empty state ("No transactions match
  your search and filters") has the same button, since that's exactly when you
  need it.
- **Tests (+10):** OR within a column, VOIDED, AND across search + card + status,
  the summary uses the same filters (`count === list.total`), DECLINED-only gives $0,
  and parsing (comma lists, trim/de-dupe, empty = none, unknown values rejected with
  the bad value named, summary parses the same).
- **Verified in the running app** against independent calculations on the raw data:
  - VISA + AMEX → 4,999 rows / $3,200,527.58
  - adding APPROVED + PENDING → 2,471 rows / $3,200,527.58, and the two ticks added
    one history entry
  - sorting by Amount alongside the filters works
  - `?status=VOIDED` → `txn_000681` with a neutral tag
  - an impossible combination → empty state with Clear filters, which works
  - Clear filters from search + filters + sort + page 2 → `/`, 10,000 rows,
    $6,488,615.40, empty input (the debounce didn't bring the search back), button
    disabled; Back restored the full previous view
  - `?cardBrand=VISA,DINERS&status=nope` → junk dropped, VISA kept (2,503)

## 2. Task 2: Summary total bug
_TODO_

## 3. Task 3: New Transaction form

### Findings before coding
- **There's no rule behind the surcharge rate in the data.** Every brand and every
  merchant uses 2.5%, 3% and 3.5% at random, independent of amount, so a rate can't be
  derived. It's a product decision.
- **The data's own surcharge rounding is wrong in 10 rows** (a cent low each). For
  example, $1,108.50 × 3% = $33.255 exactly, which rounds half-up to **$33.26**, but
  the data has **$33.25**. The generator multiplied floats (`33.254999…`) and rounded
  that. It's the same class of bug as Task 2, and the reason new money maths below is
  done in integer cents.
- The current form sends `parseInt("12.99")` = 12 (cents lost), and `""` becomes
  `NaN`. The endpoint accepts any body, forces the surcharge to 0, and builds ids
  from `length + 1`.

### Plan (agreed)
- **Every input is editable**: merchant, card brand, amount, surcharge and status.
  Total, id and timestamp are derived by the server.
- **Surcharge defaults to 3%** (server config) and can be entered either as a
  **percent** or as a **dollar amount**. Each updates the other live, and whichever the
  user typed last is what's sent. The server computes the other from it.
- **Status defaults to PENDING** (not APPROVED), so a hand-entered transaction doesn't
  count toward "Total processed" until it's approved.
- **Money on the wire is decimal strings** (`"12.34"`, `"3.125"`), parsed straight to
  integer cents / thousandths of a percent. All surcharge maths is integer with
  half-up rounding, so no floating point is involved.
- **Server-side validation** with per-field errors (`400 { fieldErrors }`), shown under
  the matching inputs.
- **Idempotency-Key** header, so a double-click or a retry after a timeout can't create
  two transactions. A reused key with different data is rejected (`422`).
- Collision-safe ids, malformed JSON → `400` (not a 500 with a stack trace), and a
  `GET /api/surcharge-config` so the form's default comes from the server.

### What I built

**API (`POST /api/transactions`)**
- **Request:**
  `{ merchantName, cardBrand, status?, amount: "12.34", surchargePercent?: "3.5" | surcharge?: "0.39" }`.
  - Response `201` with the transaction.
  - Validation failures → `400 { error, fieldErrors }` listing every bad field at once
    (`http/new-transaction.ts`, a pure function).
- **Money is exact end to end.**
  - `parseDollars` / `parsePercent` (`utils/money.ts`) read the decimal strings digit
    by digit into integer cents and thousandths of a percent.
  - `percentOfCents` computes `amount × rate` as `floor((cents × milli + 50,000) /
    100,000)`: integer half-up rounding with no float anywhere.
  - Numbers in JSON (`"amount": 12.99`) are rejected on purpose, so the value is
    exactly what the user typed.
  - The total is always computed by the server, never accepted from the client.
- **Surcharge, either way round.**
  - With `surchargePercent`, the server computes the dollars.
  - With `surcharge` (dollars), it derives the rate: $1.00 on $30.00 is stored as
    `0.033333`.
  - With neither, it uses the default (3%, `services/surcharge.ts`). Sending both is
    rejected.
  - The hard limit is 10%. **A bug the tests caught:** my first version checked the
    *rounded* surcharge against the limit, so exactly 10% of $12.99 ($1.299 → $1.30)
    was rejected. A typed percent is now checked as typed; only a typed dollar amount
    is checked as a ratio, compared as integers (`s × 100,000 ≤ a × max`).
- **Status:** any status can be chosen; the default is **PENDING**, so a hand-entered
  transaction doesn't count toward "Total processed" until it's approved.
- **Idempotency** (`http/idempotency.ts`). An optional `Idempotency-Key` header.
  - Same key + same request → the original `201` is replayed
    (`Idempotent-Replayed: true`), and no second transaction is created.
  - Same key + different request → `422`.
  - The fingerprint is the *validated* input, so `"1108.5"` and `"1108.50"` count as
    the same request.
  - In memory and bounded; in production it would be shared storage with a TTL.
- **ids** come from the highest existing id + 1, not `length + 1`, which could reuse
  an id if there were ever gaps.
- **Malformed JSON** → `400 "Request body must be valid JSON"` instead of falling
  through to the 500 handler (which still leaks stack traces; see Task 5).

**Form (`/transactions/new`)**
- An antd `Form` with inline validation that mirrors the server rules (the server's
  `fieldErrors` are shown under the matching inputs too). No request is sent until
  the client-side checks pass.
- **Every input is editable:** merchant; card brand (no pre-selection, so it's a
  deliberate choice); status (defaults to PENDING, shown as coloured tags like the
  table); amount (`$` prefix, numeric keyboard on mobile, `"$1,234.5"` tidied to
  `1234.50` on blur); and the surcharge as a **rate _or_ an amount**.
- **The two surcharge inputs stay in step.** Type a percent and the dollars update;
  type dollars and the percent updates. Whichever was typed last is what's sent, and
  changing the amount keeps that one fixed and recomputes the other (e.g. $50 on
  $1,108.50 = 4.511%; change the amount to $2,000 and it stays $50 = 2.5%).
- **A live preview** shows amount, surcharge (with the effective %), and total. It
  uses the same integer maths as the server (`web/src/utils/money.ts`).
- **A non-blocking warning** above the 3% typical card-network cap ("check that this
  merchant is permitted to surcharge at this rate"). The hard 10% limit blocks.
  Surcharge compliance is the domain, so it seemed worth surfacing rather than
  silently allowing.
- **Submitting:** the button shows a spinner and the form is disabled, so a
  double-click sends one request. The idempotency key is per intended submission:
  a retry with the same values reuses it, and any edit makes a new one. A network or
  server failure shows an alert and **keeps everything typed**. On success: a toast
  ("Transaction txn_010003 created") and back to the dashboard, where the new row is
  on top (newest first). After Task 4 this should go to the new transaction's page.
- **Consistency with the rest of the app:** the same card styling as the table, a
  "← Transactions" back link, Cancel, standard required asterisks, and the layout
  stacks to one column on narrow screens.

### Verified
- **Tests:** 116 API + 13 web, all passing.
  - money parsing (accepted and rejected forms) and half-up rounding, including
    $1,108.50 × 3% = $33.26 (where the seed data has $33.25)
  - percent and dollar surcharge modes, the exact-limit case
  - every validation message
  - idempotency: new, replay, conflict, eviction
  - ids after gaps
  - client conversions (e.g. $1 on $30 = 3.333%)
- **Live API:**
  - default → `txn_010001` $1,108.50 + $33.26 = $1,141.76, PENDING
  - same key replayed (header present, no new row); same key with different data →
    `422`
  - dollar surcharge → rate 0.033333
  - invalid body → all field errors
  - malformed JSON → `400`
- **Running app:**
  - empty submit → three inline errors, no request sent
  - every surcharge interaction above, with the warning at 3.5% and 4.511%
  - 15% blocked, and the error clears when switching back to 3%
  - simulated network failure → alert, values kept
  - retry used the same key
  - double-click → one request
  - new row `txn_010003 | AMEX | $12.99 | $0.39 | $13.38 | PENDING` at the top, and
    exactly one row created
  - server-side field errors displayed under Merchant and the active surcharge input
- (Testing note: in a hidden browser tab, antd's error and popover exit animations
  never finish, so stale messages stay in the DOM. I checked the form's real error
  state instead.)

### Not done / with more time
- One shared `money` module (and `Transaction` model) for web and API instead of
  mirrored copies.
- Store money as integer cents in the data model and API responses, not dollar floats.
- A real surcharge rules engine: per card program (debit can't be surcharged), merchant
  registration and state rules, replacing the flat 3% / 10% constants.
- Merchant autocomplete from existing merchants; "unsaved changes" prompt on Cancel.
- Persist the idempotency store (shared, with a TTL) so it survives restarts and
  works across instances.

## 4. Task 4: Transaction detail page
_TODO_

## 5. Task 5: Improvement opportunities
_TODO_

## Short questions
1. **Data flow:** _TODO_
2. **Task 1 call:** _TODO_
3. **Ship / no-ship:** _TODO_

## With more time
_TODO_
