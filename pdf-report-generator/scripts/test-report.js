// scripts/test-report.js
// Checkpoint for Stage 2: prints the full report object as JSON.
const { getReport } = require('../src/queries');
console.log(JSON.stringify(getReport(), null, 2));
