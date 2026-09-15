const express    = require('express');
const { supabase } = require('../supabaseClient');
const authGuard  = require('../middleware/authGuard');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// POST /auth/signup
// Creates a new user account in Supabase Auth.
// Body: { "email": "...", "password": "..." }
// Returns 201 on success, 400 on missing fields, 409 if email already exists.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  // Validate — never trust the client
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Supabase returns 400-level errors as JS errors (not HTTP 4xx)
    const status = error.status || 400;
    return res.status(status).json({ error: error.message });
  }

  return res.status(201).json({
    message: 'Account created successfully',
    user: {
      id:         data.user.id,
      email:      data.user.email,
      created_at: data.user.created_at,
    },
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// Authenticates a user and returns a JWT access token.
// Body: { "email": "...", "password": "..." }
// Returns 200 with tokens on success, 400 on missing fields, 401 on bad creds.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Wrong email/password comes back as an error from Supabase
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  return res.status(200).json({
    message:       'Login successful',
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in, // seconds until expiry (default 3600)
    user: {
      id:    data.user.id,
      email: data.user.email,
    },
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /auth/logout    ← PROTECTED (requires valid Bearer token)
// Signs the user out. The guard runs before this handler.
// Returns 204 No Content on success.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/logout', authGuard, async (req, res) => {
  // Note: stateless JWTs don't truly expire on server sign-out (see Stage 4
  // "real logout test" extra). Calling signOut here ends the Supabase session.
  const { error } = await supabase.auth.signOut();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(204).send(); // 204 = No Content
});

module.exports = router;
