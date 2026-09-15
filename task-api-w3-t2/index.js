const express    = require('express');
const { Pool }   = require('pg');
const swaggerUi  = require('swagger-ui-express');
const swaggerDoc = require('./openapi.json');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
//  Database connection pool  (reads DATABASE_URL from .env / environment)
// ─────────────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Convenience wrapper — keeps async errors out of unhandled rejections
const q = (sql, params = []) => pool.query(sql, params);

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 0/1 — Create table + seed (runs once at startup)
//  Retries 10× so Docker Compose startup order doesn't matter
// ─────────────────────────────────────────────────────────────────────────────
async function initDb() {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await q('SELECT 1');       // ping — throws if DB not ready
      break;
    } catch {
      if (attempt === 10) throw new Error('Cannot reach database after 10 attempts');
      console.log(`  Waiting for DB… (attempt ${attempt}/10)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await q(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         SERIAL PRIMARY KEY,
      title      TEXT    NOT NULL,
      done       BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed only when table is empty — never duplicates on restart
  const { rows: [{ count }] } = await q('SELECT COUNT(*) AS count FROM tasks');
  if (parseInt(count) === 0) {
    await q(`
      INSERT INTO tasks (title, done) VALUES
        ('Learn Express.js', false),
        ('Build CRUD API',   true),
        ('Push to GitHub',   false)
    `);
    console.log('  Seeded 3 example tasks.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Root & health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '3.0', storage: 'PostgreSQL', endpoints: ['/tasks'] });
});

// Stretch: health check pings the DB — real companies gate deploys on this
app.get('/health', async (req, res) => {
  try {
    await q('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
});

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 2 — Read from Postgres
//  Stretch: ?done=   ?search=   (Postgres ILIKE = case-insensitive LIKE)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/tasks', async (req, res) => {
  const { done, search } = req.query;
  const conditions = [];
  const params     = [];

  if (done !== undefined) {
    params.push(done === 'true');
    conditions.push(`done = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`title ILIKE $${params.length}`);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await q(`SELECT * FROM tasks${where} ORDER BY id`, params);
  res.json(rows);
});

app.get('/tasks/:id', async (req, res) => {
  const { rows } = await q('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: `Task ${req.params.id} not found` });
  res.json(rows[0]);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 3 — Create (INSERT … RETURNING *)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/tasks', async (req, res) => {
  const { title } = req.body || {};
  if (!title || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required and cannot be empty' });
  }
  const { rows: [task] } = await q(
    'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
    [String(title).trim(), false]
  );
  res.status(201).json(task);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 3 — Update (UPDATE … RETURNING *)
// ─────────────────────────────────────────────────────────────────────────────
app.put('/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const { rows } = await q('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: `Task ${id} not found` });

  const { title, done } = req.body || {};
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Provide at least one of: title, done' });
  }
  if (title !== undefined && String(title).trim() === '') {
    return res.status(400).json({ error: 'title cannot be empty' });
  }

  const newTitle = title !== undefined ? String(title).trim() : rows[0].title;
  const newDone  = done  !== undefined ? Boolean(done)        : rows[0].done;

  const { rows: [updated] } = await q(
    'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
    [newTitle, newDone, id]
  );
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 3 — Delete
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const { rows } = await q('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: `Task ${id} not found` });
  await q('DELETE FROM tasks WHERE id = $1', [id]);
  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stretch — Stats (computed in SQL with FILTER)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/stats', async (req, res) => {
  const { rows: [row] } = await q(
    'SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE done) AS done FROM tasks'
  );
  const total = parseInt(row.total);
  const done  = parseInt(row.done);
  res.json({ total, done, open: total - done });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Global error handler — catches any unhandled async error
// ─────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Task API  →  http://localhost:${PORT}`);
      console.log(`  Swagger   →  http://localhost:${PORT}/docs`);
      console.log(`  Database  →  PostgreSQL (${process.env.DATABASE_URL})\n`);
    });
  })
  .catch(err => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
