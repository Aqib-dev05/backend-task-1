// src/render.js
// You do not draw a PDF — you write a small HTML page and ask a browser
// (headless Chromium via Playwright) to "print" it.
const path = require('path');
const { chromium } = require('playwright');

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function money(n) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// --- HTML template -------------------------------------------------
function buildHtml(report) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const topRows = report.topProducts.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(p.product)}</td>
      <td class="num">${p.orders}</td>
      <td class="num">${money(p.revenue)}</td>
    </tr>`).join('');

  const dayRows = report.ordersPerDay.map((d) => `
    <tr>
      <td>${esc(d.day)}</td>
      <td class="num">${d.orders}</td>
    </tr>`).join('');

  const allRows = report.allOrders.map((o) => `
    <tr>
      <td class="num">${o.id}</td>
      <td>${esc(o.customer)}</td>
      <td>${esc(o.product)}</td>
      <td class="num">${money(o.amount)}</td>
      <td>${esc(o.created_at)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sales Report — ${today}</title>
<style>
  :root { --brand: #4f46e5; --ink: #111827; --muted: #6b7280; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: var(--ink);
         margin: 0; padding: 40px 48px; font-size: 13px; }
  header.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .logo { width: 34px; height: 34px; border-radius: 8px; background: var(--brand);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 16px; }
  h1 { font-size: 22px; margin: 0; }
  .subtitle { color: var(--muted); margin-bottom: 28px; }
  .cards { display: flex; gap: 16px; margin-bottom: 32px; }
  .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; }
  .card .label { color: var(--muted); font-size: 11px; text-transform: uppercase;
                 letter-spacing: .06em; }
  .card .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
  h2 { font-size: 15px; margin: 28px 0 10px; border-bottom: 2px solid var(--brand);
       padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
  th { background: #f9fafb; font-size: 11px; text-transform: uppercase;
       letter-spacing: .05em; color: var(--muted); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  /* The page-break trap: keep rows whole and repeat the header on every page */
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  footer.page { position: running(pageFooter); }
  @page { margin: 18mm 16mm; @bottom-center { content: "Little Shop — page " counter(page) " of " counter(pages);
          font-size: 9px; color: var(--muted); } }
</style>
</head>
<body>
  <header class="brand">
    <div class="logo">LS</div>
    <div>
      <h1>Sales Report</h1>
      <div class="subtitle">Little Shop &middot; generated ${today}</div>
    </div>
  </header>

  <section class="cards">
    <div class="card"><div class="label">Total orders</div><div class="value">${report.totals.totalOrders}</div></div>
    <div class="card"><div class="label">Total revenue</div><div class="value">${money(report.totals.totalRevenue)}</div></div>
    <div class="card"><div class="label">Average order</div><div class="value">${money(report.totals.avgOrder)}</div></div>
  </section>

  <h2>Top 5 products by revenue</h2>
  <table>
    <thead><tr><th>#</th><th>Product</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>

  <h2>Orders per day — last 7 days</h2>
  <table>
    <thead><tr><th>Day</th><th class="num">Orders</th></tr></thead>
    <tbody>${dayRows}</tbody>
  </table>

  <h2>All orders (${report.allOrders.length})</h2>
  <table>
    <thead><tr><th class="num">ID</th><th>Customer</th><th>Product</th><th class="num">Amount</th><th>Date</th></tr></thead>
    <tbody>${allRows}</tbody>
  </table>
</body>
</html>`;
}

// --- HTML → PDF ----------------------------------------------------
async function renderPdf(html, pdfPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
  return pdfPath;
}

module.exports = { buildHtml, renderPdf };
