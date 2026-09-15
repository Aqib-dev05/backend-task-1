const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');

const app = express();
const PORT = 3000;

app.use(express.json());

// ─────────────────────────────────────────────────────────────
//  In-memory "database"  (Stage 2)
// ─────────────────────────────────────────────────────────────
const SEED_TASKS = [
  { id: 1, title: 'Learn Express.js', done: false },
  { id: 2, title: 'Build CRUD API',   done: true  },
  { id: 3, title: 'Push to GitHub',   done: false },
];

let tasks  = SEED_TASKS.map(t => ({ ...t }));
let nextId = 4;

// ─────────────────────────────────────────────────────────────
//  Stage 1 — Root & health endpoints
// ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─────────────────────────────────────────────────────────────
//  Stage 5 — Swagger UI at /docs
// ─────────────────────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─────────────────────────────────────────────────────────────
//  Stage 2 — Read: list all tasks & single task
//  Stretch: ?done=true/false  |  ?search=keyword
// ─────────────────────────────────────────────────────────────
app.get('/tasks', (req, res) => {
  const { done, search } = req.query;
  let result = tasks;

  if (done !== undefined) {
    const flag = done === 'true';
    result = result.filter(t => t.done === flag);
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(q));
  }

  res.json(result);
});

app.get('/tasks/:id', (req, res) => {
  const id   = parseInt(req.params.id);
  const task = tasks.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }
  res.json(task);
});

// ─────────────────────────────────────────────────────────────
//  Stage 3 — Create a task
// ─────────────────────────────────────────────────────────────
app.post('/tasks', (req, res) => {
  const { title } = req.body || {};

  if (!title || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required and cannot be empty' });
  }

  const task = { id: nextId++, title: String(title).trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
});

// ─────────────────────────────────────────────────────────────
//  Stage 4 — Update a task
// ─────────────────────────────────────────────────────────────
app.put('/tasks/:id', (req, res) => {
  const id  = parseInt(req.params.id);
  const idx = tasks.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body || {};

  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Provide at least one of: title, done' });
  }
  if (title !== undefined && String(title).trim() === '') {
    return res.status(400).json({ error: 'title cannot be empty' });
  }

  if (title !== undefined) tasks[idx].title = String(title).trim();
  if (done  !== undefined) tasks[idx].done  = Boolean(done);

  res.json(tasks[idx]);
});

// ─────────────────────────────────────────────────────────────
//  Stage 4 — Delete a task
// ─────────────────────────────────────────────────────────────
app.delete('/tasks/:id', (req, res) => {
  const id  = parseInt(req.params.id);
  const idx = tasks.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  tasks.splice(idx, 1);
  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────
//  Stretch — Stats endpoint
// ─────────────────────────────────────────────────────────────
app.get('/stats', (req, res) => {
  const done = tasks.filter(t => t.done).length;
  res.json({ total: tasks.length, done, open: tasks.length - done });
});

// ─────────────────────────────────────────────────────────────
//  Stretch — Reset to seed data
// ─────────────────────────────────────────────────────────────
app.post('/reset', (req, res) => {
  tasks  = SEED_TASKS.map(t => ({ ...t }));
  nextId = 4;
  res.json({ message: 'Tasks reset to seed data', tasks });
});

// ─────────────────────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Task API  →  http://localhost:${PORT}`);
  console.log(`  Swagger   →  http://localhost:${PORT}/docs\n`);
});
