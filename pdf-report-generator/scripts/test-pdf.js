// scripts/test-pdf.js
// Checkpoint for Stage 3: renders reports/test.pdf from real data.
const path = require('path');
const { getReport } = require('../src/queries');
const { buildHtml, renderPdf } = require('../src/render');

(async () => {
  const report = getReport();
  const out = path.join(__dirname, '..', 'reports', 'test.pdf');
  await renderPdf(buildHtml(report), out);
  console.log(`Wrote ${out}`);
})();
