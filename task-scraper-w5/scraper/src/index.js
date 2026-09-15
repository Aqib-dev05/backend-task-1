/**
 * FlyRank Internship — Week 5 — A9: The polite scraper
 * Target: https://books.toscrape.com  (public practice sandbox)
 * Lane  : JavaScript / Node.js 20+
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const cheerio = require('cheerio');
const { z }   = require('zod');

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL   = 'https://books.toscrape.com';
const START_URL  = 'https://books.toscrape.com/catalogue/page-1.html';
const ROBOTS_URL = 'https://books.toscrape.com/robots.txt';
const MAX_PAGES  = 3;
const DELAY_MS   = 600;   // ≥ 500 ms between live requests — be a polite guest
const TIMEOUT_MS = 10_000;

// Honest user-agent: who we are + a contact link
const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/Aqib-dev05/backend-task-1)';

const ROOT       = path.join(__dirname, '..');
const CACHE_DIR  = path.join(ROOT, 'cache');
const OUTPUT_DIR = path.join(ROOT, 'output');

// ─── Run-report state (mutated throughout the run) ────────────────────────────
const report = {
  started_at:      new Date().toISOString(),
  duration_ms:     0,
  catalogue_pages: 0,
  discovered_urls: 0,
  cache_hits:      0,
  pages_fetched:   0,
  valid_records:   0,
  invalid_records: 0,
  failed_pages:    0,
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function ensureDirs() {
  [CACHE_DIR, OUTPUT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

/** URL → safe filename for the cache directory */
function cacheFile(url) {
  const safe = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 120);
  return path.join(CACHE_DIR, safe + '.html');
}

/** Sleep helper */
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Stage 1: fetch-with-cache ────────────────────────────────────────────────
/**
 * Returns { html, fromCache }.
 * Throws an error (with .status) if the server returns anything other than 200.
 */
async function fetchWithCache(url) {
  const file = cacheFile(url);

  if (fs.existsSync(file)) {
    console.log(`  CACHE HIT  ${url}`);
    report.cache_hits++;
    return { html: fs.readFileSync(file, 'utf8'), fromCache: true };
  }

  console.log(`  FETCH      ${url}`);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      signal:  controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status !== 200) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const html = await res.text();
  fs.writeFileSync(file, html, 'utf8');
  report.pages_fetched++;
  return { html, fromCache: false };
}

// ─── Stage 0: check robots.txt ────────────────────────────────────────────────
async function checkRobots() {
  console.log('\n─── Stage 0: robots.txt ──────────────────────');
  try {
    const { html: txt } = await fetchWithCache(ROBOTS_URL);
    console.log('  robots.txt result:\n');
    console.log(txt.split('\n').map(l => '    ' + l).join('\n'));
  } catch (err) {
    if (err.status === 404) {
      console.log('  no robots.txt found — not permission, just missing');
    } else {
      console.log('  could not fetch robots.txt:', err.message);
    }
  }
}

// ─── Stage 2: discover catalogue pages + collect book URLs ───────────────────
/**
 * Returns a Map<bookUrl, cataloguePageUrl> — sourcePage is tracked per book.
 */
async function discoverBooks() {
  console.log('\n─── Stage 2: catalogue discovery ────────────────');
  const bookMap = new Map();    // url → sourcePage
  let pageUrl   = START_URL;
  let pagesVisited = 0;

  while (pageUrl && pagesVisited < MAX_PAGES) {
    const { html, fromCache } = await fetchWithCache(pageUrl);
    if (!fromCache) await sleep(DELAY_MS);

    pagesVisited++;
    report.catalogue_pages = pagesVisited;
    const sourcePage = pageUrl;
    const $ = cheerio.load(html);

    // Collect every book link on this catalogue page
    $('article.product_pod h3 a').each((_, el) => {
      const href     = $(el).attr('href');                  // e.g. ../../a-book/index.html
      const absolute = new URL(href, pageUrl).href;          // → full https://...
      if (!bookMap.has(absolute)) {
        bookMap.set(absolute, sourcePage);
      }
    });

    // Follow the "next" link — never hardcode URLs
    const nextHref = $('li.next a').attr('href');
    pageUrl = nextHref ? new URL(nextHref, pageUrl).href : null;
  }

  console.log(
    `\n  catalogue_pages=${pagesVisited}  discovered=${bookMap.size}  unique_urls=${bookMap.size}`
  );
  report.discovered_urls = bookMap.size;
  return bookMap;
}

// ─── Stage 3: extract raw record from a book detail page ─────────────────────
function extractRaw($, url, sourcePage) {
  const title             = $('h1').first().text().trim();
  const price_text        = $('p.price_color').first().text().trim();
  const availability_text = $('p.availability').first().text().trim();

  // Rating: class="star-rating Three" → extract the word part
  const ratingClass = $('p.star-rating').first().attr('class') || '';
  const rating_text = ratingClass.replace('star-rating', '').trim();

  // Description: the <p> that follows #product_description
  // Some books have no description section at all → null, never invented
  const descEl      = $('#product_description ~ p').first();
  const description = descEl.length ? descEl.text().trim() || null : null;

  return {
    title,
    product_url: url,
    price_text,
    availability_text,
    rating_text,
    description,
    source_page: sourcePage,
    fetched_at:  new Date().toISOString(),
  };
}

// ─── Stage 4: normalize raw → clean ──────────────────────────────────────────
function normalize(raw) {
  // "£51.77" → 51.77  (strip every non-digit except the dot)
  const price_gbp = parseFloat(raw.price_text.replace(/[^0-9.]/g, ''));
  return { ...raw, price_gbp };
}

// ─── Stage 4: Zod schema — the contract every record must satisfy ─────────────
const BookSchema = z.object({
  title:             z.string().min(1),
  product_url:       z.string().url(),
  price_text:        z.string().min(1),
  price_gbp:         z.number().positive(),
  availability_text: z.string().min(1),
  rating_text:       z.string().min(1),
  description:       z.string().nullable(),
  source_page:       z.string().url(),
  fetched_at:        z.string().datetime(),
});

// ─── Stage 5: fetch one book, retry once on transient errors ─────────────────
async function fetchBook(url, sourcePage) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { html, fromCache } = await fetchWithCache(url);
      if (!fromCache) await sleep(DELAY_MS);
      const $ = cheerio.load(html);
      return extractRaw($, url, sourcePage);
    } catch (err) {
      // 404 = page gone, 403 = blocked — retrying would be rude and useless
      if (err.status === 404 || err.status === 403) throw err;
      if (attempt === 2) throw err;
      console.log(`  RETRY (attempt ${attempt}) ${url} — ${err.message}`);
      await sleep(2_000);
    }
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
async function main() {
  ensureDirs();
  const startMs = Date.now();

  await checkRobots();

  const bookMap = await discoverBooks();

  // Stage 5 proof: one deliberately broken URL in the list
  const fakeUrl = 'https://books.toscrape.com/catalogue/this-book-does-not-exist_9999/index.html';
  bookMap.set(fakeUrl, START_URL);

  console.log('\n─── Stage 3–5: scraping book detail pages ────────');

  const valid  = [];
  const errors = [];

  for (const [url, sourcePage] of bookMap.entries()) {
    try {
      const raw    = await fetchBook(url, sourcePage);
      const clean  = normalize(raw);
      const result = BookSchema.safeParse(clean);

      if (result.success) {
        valid.push(result.data);
      } else {
        const reason = result.error.issues.map(i => `${i.path}: ${i.message}`).join('; ');
        console.log(`  INVALID  ${url} — ${reason}`);
        errors.push({ url, reason, record: clean });
        report.invalid_records++;
      }
    } catch (err) {
      console.log(`  FAILED   ${url} — ${err.message}`);
      errors.push({ url, reason: err.message });
      report.failed_pages++;
    }
  }

  // Deduplicate by product_url → idempotent re-runs never produce duplicates
  const unique = [...new Map(valid.map(b => [b.product_url, b])).values()];

  report.valid_records = unique.length;
  report.duration_ms   = Date.now() - startMs;

  // Write outputs
  const booksPath  = path.join(OUTPUT_DIR, 'books.json');
  const errorsPath = path.join(OUTPUT_DIR, 'errors.json');
  const reportPath = path.join(OUTPUT_DIR, 'run-report.json');

  fs.writeFileSync(booksPath,  JSON.stringify(unique,  null, 2));
  fs.writeFileSync(errorsPath, JSON.stringify(errors,  null, 2));
  fs.writeFileSync(reportPath, JSON.stringify(report,  null, 2));

  console.log('\n─── Run complete ─────────────────────────────────');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n  ✓ books.json      → ${unique.length} valid records`);
  console.log(`  ✓ errors.json     → ${errors.length} entries`);
  console.log(`  ✓ run-report.json → duration ${report.duration_ms}ms`);
  console.log('──────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
