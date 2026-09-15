const express = require('express');
const router  = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// GET /public/info
// Open endpoint — no authentication required. Anyone can call this.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/info', (req, res) => {
  return res.status(200).json({
    message: 'Welcome stranger! This info is public.',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
