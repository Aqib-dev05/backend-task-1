const { supabase } = require('../supabaseClient');

/**
 * authGuard — the reusable middleware guard.
 *
 * Sits in front of every protected route. It:
 *   1. Extracts the Bearer token from the Authorization header
 *   2. Verifies it with Supabase (real network call — forgeries fail here)
 *   3. Attaches the verified user to req.user, then calls next()
 *   4. Returns 401 early if anything is wrong — the route handler never runs
 */
async function authGuard(req, res, next) {
  // ── Step 1: Check the Authorization header exists ──────────────────────
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // ── Step 2: Pull the raw token string out ──────────────────────────────
  const token = authHeader.split(' ')[1]; // "Bearer <token>" → "<token>"

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // ── Step 3: Verify with Supabase (this makes a real network call) ──────
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── Step 4: Attach the verified user and let the route run ─────────────
  req.user  = data.user;   // e.g. req.user.id, req.user.email
  req.token = token;       // useful for logout
  next();
}

module.exports = authGuard;
