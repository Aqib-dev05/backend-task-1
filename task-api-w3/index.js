const express      = require('express');
const Database     = require('better-sqlite3');
const swaggerUi    = require('swagger-ui-express');
const swaggerDoc   = require('./openapi.json');

const app  = express();
const PORT = 3000;

app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 0 — Open / create SQLite database
// ─────────────────────────────────────────────────────────────────────────────
const db = new Database('tasks.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// Seed 3 tasks ONLY when table is empty — never duplicates on restart
const rowCount = db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c;
if (rowCount === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const seedAll = db.transaction(() => {
    insert.run('Learn Express.js', 0);
    insert.run('Build CRUD API',   1);
    insert.run('Push to GitHub',   0);
  });
  seedAll();
  console.log('  Seeded 3 example tasks.');
}

// SQLite stores done as 0/1 — convert to boolean for API responses
const fmt = (row) => row ? { ...row, done: Boolean(row.done) } : null;

// ─────────────────────────────────────────────────────────────────────────────
//  Root & health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '2.0', storage: 'SQLite', endpoints: ['/tasks'] });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 1 — Read from database
//  Stretch: ?done=  ?search=  (SQL WHERE + LIKE, no in-code loops)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/tasks', (req, res) => {
  const { done, search } = req.query;
  const conditions = [];
  const params     = [];

  if (done !== undefined) {
    conditions.push('done = ?');
    params.push(done === 'true' ? 1 : 0);
  }
  if (search) {
    conditions.push('title LIKE ?');
    params.push(`%${search}%`);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const rows  = db.prepare(`SELECT * FROM tasks${where} ORDER BY id`).all(...params);
  res.json(rows.map(fmt));
});

app.get('/tasks/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: `Task ${req.params.id} not found` });
  res.json(fmt(row));
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 2 — Create (INSERT INTO)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/tasks', (req, res) => {
  const { title } = req.body || {};
  if (!title || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required and cannot be empty' });
  }

  const info = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)').run(String(title).trim(), 0);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(fmt(task));
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stage 3 — Update (UPDATE ... SET) & Delete (DELETE FROM)
// ─────────────────────────────────────────────────────────────────────────────
app.put('/tasks/:id', (req, res) => {
  const id  = req.params.id;
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: `Task ${id} not found` });

  const { title, done } = req.body || {};
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Provide at least one of: title, done' });
  }
  if (title !== undefined && String(title).trim() === '') {
    return res.status(400).json({ error: 'title cannot be empty' });
  }

  const newTitle = title !== undefined ? String(title).trim() : row.title;
  const newDone  = done  !== undefined ? (done ? 1 : 0)        : row.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(newTitle, newDone, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(fmt(updated));
});

app.delete('/tasks/:id', (req, res) => {
  const id  = req.params.id;
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: `Task ${id} not found` });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stretch — Stats (computed in SQL, not in code)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/stats', (req, res) => {
  const { total, done } = db.prepare(
    'SELECT COUNT(*) AS total, SUM(done) AS done FROM tasks'
  ).get();
  const d = done || 0;
  res.json({ total, done: d, open: total - d });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Task API  →  http://localhost:${PORT}`);
  console.log(`  Swagger   →  http://localhost:${PORT}/docs`);
  console.log(`  Database  →  tasks.db\n`);
});
