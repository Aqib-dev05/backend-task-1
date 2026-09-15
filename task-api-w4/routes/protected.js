const express   = require('express');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// Apply authGuard to ALL routes in this file.
// One line of middleware protects the whole router — no copy-pasting.
router.use(authGuard);

// ──────────────────────────────────────────────────────────────────────────────
// GET /protected/profile
// Returns the verified user's profile data.
// authGuard already verified the token and attached req.user before we get here.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const { id, email, created_at } = req.user;

  return res.status(200).json({
    message: 'Profile data — only visible to authenticated users',
    user: { id, email, created_at },
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /protected/dashboard
// A SECOND protected route — uses the EXACT SAME authGuard, zero new auth code.
// This is the Stage 4 checkpoint: prove reuse works.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  return res.status(200).json({
    message: `Welcome to your dashboard, ${req.user.email}!`,
    user_id: req.user.id,
    stats: {
      projects:  3,
      api_calls: 142,
      last_seen: new Date().toISOString(),
    },
  });
});

module.exports = router;
