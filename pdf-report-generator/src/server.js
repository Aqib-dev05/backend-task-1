// src/server.js
// The report pipeline behind one door: POST /reports runs
// query → render → store → insert, and hands back a link to the file.
// Rule: store and link, don't pass the bytes around — JSON responses
// only ever carry the artifact's path, never its bytes.
const path = require('path');
const fs = require('fs');
const express = require('express');
const { db } = require('./db');
const { getReport } = require('./queries');
const { buildHtml, renderPdf } = require('./render');

const app = express();
app.use(express.json());

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

// --- Stage 0 -------------------------------------------------------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --- Stage 4 + 5 ---------------------------------------------------
// Idempotency in business terms: a report already generated today is
// returned again (200, same id) instead of generating a duplicate.
// POST {"force": true} skips the check.
app.post('/reports', async (req, res) => {
  const force = Boolean(req.body && req.body.force);

  if (!force) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = db.prepare(
      "SELECT * FROM reports WHERE created_at LIKE ? || '%' ORDER BY id DESC LIMIT 1"
    ).get(today);
    if (existing) {
      return res.status(200).json({
        id: existing.id,
        file: `/reports/${existing.id}/file`,
        reused: true,
      });
    }
  }

  try {
    // 1. query — SQL aggregation → report object
    const report = getReport();

    // 2. render — HTML → PDF via headless Chromium (takes a few seconds)
    const id = db.prepare('INSERT INTO reports (path, created_at) VALUES (?, ?)')
      .run('', new Date().toISOString()).lastInsertRowid;
    const fileName = `sales-report-${new Date().toISOString().slice(0, 10)}-${id}.pdf`;
    const pdfPath = path.join(REPORTS_DIR, fileName);
    await renderPdf(buildHtml(report), pdfPath);

    // 3. store — update the bookkeeping row with the real path
    db.prepare('UPDATE reports SET path = ? WHERE id = ?').run(pdfPath, id);

    // 4. link — the response carries the link, never the bytes
    return res.status(201).json({ id, file: `/reports/${id}/file` });
  } catch (err) {
    console.error('Report generation failed:', err);
    return res.status(500).json({ error: 'report generation failed' });
  }
});

// --- Extra: the control panel --------------------------------------
app.get('/reports', (req, res) => {
  const rows = db.prepare('SELECT id, created_at AS createdAt FROM reports ORDER BY id DESC').all();
  res.json(rows.map((r) => ({ ...r, file: `/reports/${r.id}/file` })));
});

// --- GET one report record (unknown id → 404) ----------------------
app.get('/reports/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'report not found' });
  res.json({ id: row.id, createdAt: row.created_at, file: `/reports/${row.id}/file` });
});

// --- The only endpoint that moves megabytes ------------------------
app.get('/reports/:id/file', (req, res) => {
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'report not found' });
  if (!row.path || !fs.existsSync(row.path)) {
    return res.status(410).json({ error: 'report file is gone' });
  }
  res.sendFile(row.path);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
