require('dotenv').config();

const express      = require('express');
const swaggerUi    = require('swagger-ui-express');
const openApiSpec  = require('./openapi.json');

// Routes
const authRoutes      = require('./routes/auth');
const publicRoutes    = require('./routes/public');
const protectedRoutes = require('./routes/protected');

// Supabase client — imported here just to trigger the env-variable check at startup
const { supabase } = require('./supabaseClient');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json()); // Parse JSON request bodies

// ── Swagger UI at /docs ────────────────────────────────────────────────────────
// Click Authorize → paste your access_token → Try it out on protected routes
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  swaggerOptions: {
    persistAuthorization: true, // keeps the token after page refresh
  },
}));

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/auth',      authRoutes);       // /auth/signup, /auth/login, /auth/logout
app.use('/public',    publicRoutes);     // /public/info
app.use('/protected', protectedRoutes);  // /protected/profile, /protected/dashboard

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Server running on http://localhost:${PORT}`);
  console.log(`📖  Swagger docs  → http://localhost:${PORT}/docs`);
  console.log(`🔑  Connected to Supabase: ${process.env.SUPABASE_URL}`);
});
