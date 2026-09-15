# PDF Report Generator — Little Shop

FlyRank Internship · Backend Track · Week 4 · Assignment A8.
Query data with SQL → render it into a real PDF report → let the API generate
and hand out the file **by link**. No background jobs — the whole pipeline runs
inside one endpoint.

**Dataset: Option A — the little shop** (`report.db` → table `orders`, ~200 seeded rows).

## Run it

```bash
npm install
npx playwright install chromium   # one-time, ~1 min, free

npm run seed                      # fills report.db (safe to run twice)
npm start                         # server on http://localhost:3000
```

Then, in another terminal:

```bash
curl -i http://localhost:3000/health
time curl -i -X POST http://localhost:3000/reports        # 201 + link, after a visible pause
curl -i -X POST http://localhost:3000/reports             # 200, SAME id (idempotent)
curl -i -X POST -H "Content-Type: application/json" \
     -d '{"force":true}' http://localhost:3000/reports    # 201, NEW id
curl -o my-report.pdf http://localhost:3000/reports/1/file
```

## The pipeline

```
POST /reports ──▶ getReport()  (SQL aggregation)
              ──▶ buildHtml()  (template string)
              ──▶ renderPdf()  (Playwright → headless Chromium → A4 PDF)
              ──▶ save to reports/<id>.pdf  +  INSERT INTO reports
              ──▶ 201 {"id":…, "file":"/reports/<id>/file"}
```

**One rule: store and link, don't pass the bytes around.** The PDF is an
artifact on disk; every JSON response only ever holds its link. Only
`GET /reports/:id/file` moves the megabytes.

## Endpoints

| Method | Path | What |
|---|---|---|
| GET | `/health` | `{"status":"ok"}` |
| POST | `/reports` | runs the pipeline; `{"force":true}` skips the daily check |
| GET | `/reports` | control panel — list all reports with links |
| GET | `/reports/:id` | one record; unknown id → 404 |
| GET | `/reports/:id/file` | serves the PDF from disk |

## The aggregation SQL (Stage 2)

```sql
-- totals
SELECT COUNT(*) AS totalOrders,
       ROUND(SUM(amount), 2) AS totalRevenue,
       ROUND(AVG(amount), 2)  AS avgOrder
FROM orders;

-- top 5 products by revenue
SELECT product, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
FROM orders
GROUP BY product
ORDER BY revenue DESC
LIMIT 5;

-- orders per day, last 7 days
SELECT created_at AS day, COUNT(*) AS orders
FROM orders
WHERE created_at >= date('now', '-7 days')
GROUP BY created_at
ORDER BY created_at ASC;

-- the long table (every order)
SELECT id, customer, product, amount, created_at
FROM orders
ORDER BY created_at DESC, id DESC;
```

## The page-break trap (Stage 3)

The long table crosses a page break, and rows get sliced in half. Fixed with
print CSS: `tr { break-inside: avoid; }` and the header row inside a real
`<thead>` so Chromium repeats it on every page.

## POST → download proof (Stage 4)

```
$ time curl -i -X POST http://localhost:3000/reports
HTTP/1.1 201 Created
{"id":1,"file":"/reports/1/file"}
real    0m2.9s          ← visible pause: browser launch + render

$ curl -o my-report.pdf http://localhost:3000/reports/1/file
$ open my-report.pdf    ← a real PDF of real data, ≥2 clean pages
```

**When would I move this work out of the request?** The moment the wait
hurts: big reports (thousands of rows), many simultaneous users, or any
client that times out — then generation belongs in a background job
(Inngest etc.) with a `pending → done` status, and the endpoint returns 202.

## Ask twice, get one (Stage 5)

POST checks for a report already generated **today**; if one exists it
returns `200` with the same id instead of generating again. `{"force":true}`
bypasses the check.

- **What it protects against:** a double-clicked "Generate report" button
  creating duplicate artifacts and confusing the user about which file is real.
- **Where missing this costs money:** sending a customer the same invoice
  email twice — "never email a customer twice." Duplicate payment-confirmation
  or refund emails generate support tickets and, in some jurisdictions,
  fines under messaging regulations.

```bash
$ curl -s -X POST localhost:3000/reports && curl -s -X POST localhost:3000/reports
{"id":3,"file":"/reports/3/file","reused":true}
{"id":3,"file":"/reports/3/file","reused":true}   ← same id, one new file in reports/
```

## Stretch idea — the big-table experiment

Seed 5,000 rows (`ORDER_COUNT` in `src/seed.js`) and POST again: the endpoint
takes noticeably longer (browser launch dominates, then pagination of the long
table). Lesson: rendering inside the request scales poorly — the right next
step is a background job plus a status endpoint.

## Project layout

```
src/
  db.js      # SQLite file + schema (orders + reports tables)
  seed.js    # ~200 random orders, DELETE-first so it's safe to run twice
  queries.js # the four aggregations → one report object
  render.js  # HTML template + Playwright → A4 PDF
  server.js  # Express: /health, POST /reports, GET /reports/:id[/file]
scripts/
  test-report.js  # prints the report JSON (Stage 2 checkpoint)
  test-pdf.js     # writes reports/test.pdf (Stage 3 checkpoint)
```

`reports/` and `report.db` are in `.gitignore` — generated artifacts and
databases do not belong in Git; the seed script is their source of truth.
