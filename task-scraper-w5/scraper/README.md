# The Polite Scraper

FlyRank Internship · Backend Track · Week 5 · Assignment A9

A seven-stage, polite scraping pipeline that downloads 60 books from a public practice sandbox, normalizes and validates every record, survives broken pages, and ends every run with an honest report.

---

## Run it

```bash
npm install
npm start
```

Outputs land in `output/`:

| File | Contents |
|---|---|
| `books.json` | 60 validated, unique book records |
| `errors.json` | Any records that failed validation or fetch |
| `run-report.json` | Counts, timings, cache hits |

---

## Target classification

| Field | Value |
|---|---|
| **Site** | [Books to Scrape](https://books.toscrape.com) |
| **Type** | Public practice sandbox — *"A website to practise your scraping skills"* |
| **Scope** | First 3 catalogue pages only (60 books total) |
| **Data collected** | Title, price, availability, star rating, description, URL, timestamp |
| **Why appropriate** | The site exists specifically so developers can practise on it |

**robots.txt result:**
```
User-agent: *
Disallow:
```
No paths disallowed. All bots are welcome. This is expected for a practice sandbox.

> I will not reuse this code on another site without checking its rules and terms first.

---

## Politeness rules

- **User-agent**: `FlyRankInternshipA9/1.0 (+https://github.com/Aqib-dev05/backend-task-1)` — honest identification, contact link included
- **Delay**: 600 ms between every live request — the site feels us once, not sixty times in a second
- **Timeout**: 10 seconds — never waits forever
- **Cache**: HTML saved in `cache/` — second run reads from disk, zero network requests
- **Status check**: any non-200 response is an error, never parsed as HTML

---

## Record schema (Zod)

```js
{
  title:             string (min 1)
  product_url:       string (url)    ← canonical identity; deduplicates re-runs
  price_text:        string          ← "£51.77"   (raw — provenance)
  price_gbp:         number (> 0)   ← 51.77      (clean — sortable)
  availability_text: string
  rating_text:       string          ← "Three", "Four", …
  description:       string | null  ← null when the page has none (never invented)
  source_page:       string (url)   ← which catalogue page discovered this book
  fetched_at:        ISO datetime   ← provenance timestamp
}
```

Records that fail the schema go to `errors.json`. They never enter `books.json`.

---

## Idempotency

Running the scraper twice gives exactly 60 records — never 120. The final step deduplicates by `product_url` before writing, so a second run refreshes values in place instead of appending.

---

## Failure handling

- Each book page is wrapped independently — one broken page can't kill the run
- One retry on timeout or 5xx; no retry on 404/403
- A deliberately broken URL is in the list at runtime to prove Stage 5 works — the run finishes with `failed_pages: 1`, all 60 good records intact

---

## Sample run-report.json

```json
{
  "started_at": "2026-09-15T10:00:00.000Z",
  "duration_ms": 45210,
  "catalogue_pages": 3,
  "discovered_urls": 60,
  "cache_hits": 0,
  "pages_fetched": 61,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 1
}
```

Second run (all from cache):
```json
{
  "cache_hits": 61,
  "pages_fetched": 0,
  "duration_ms": 820
}
```

---

## Why no browser was needed

The data — prices, titles, descriptions — is in the plain HTML that the server sends. A browser would parse the same HTML and add ~300 MB of Chromium, ~2 s startup time, and 10× the memory cost per page. For static HTML, `fetch` + Cheerio is the right tool.

*(The stretch goal tests this: fetching quotes.toscrape.com/js with plain HTTP returns an empty list because that page renders its quotes in JavaScript. That's when a browser is needed — and only then.)*

---

## Ethics note

Use an official API when one exists — it's faster, more stable, and explicitly permitted. Never bypass logins, paywalls, or scraping blocks — that's both unethical and against most sites' terms. Collect only what you need; store only what you'll use. This assignment touches nothing but a sandbox built for exactly this purpose.

---

## Git commit history

```
Stage 0: classify scraping target
Stage 1: fetch and cache HTML
Stage 2: discover three catalogue pages
Stage 3: extract book details
Stage 4: validate normalized records
Stage 5: survive failures, report the run
Stage 6: publish scraper evidence
```

---

## Tech

- **Runtime** — Node.js 20+ (built-in `fetch`)
- **HTML parser** — Cheerio
- **Schema validator** — Zod
- **Target** — Books to Scrape (public sandbox)
