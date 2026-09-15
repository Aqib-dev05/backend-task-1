# Task API — v2 (SQLite)

FlyRank Internship · Backend Track · Week 3 · Assignment A2

Same endpoints as Week 2 — but now your data **survives a server restart**.  
Storage moved from an in-memory array to a real SQLite database (`tasks.db`).

---

## Install & run

```bash
npm install
npm start          # node index.js
npm run dev        # nodemon (auto-reload)
```

`tasks.db` is created automatically on first run — no manual setup needed.  
Three example tasks are seeded only once (the table checks its own row count).

Server → **http://localhost:3000**  
Swagger → **http://localhost:3000/docs**

---

## Endpoints

| Method | Path | Description | Status codes |
|--------|------|-------------|--------------|
| GET | `/` | API info (name, version, storage) | 200 |
| GET | `/health` | Health check | 200 |
| GET | `/tasks` | List all tasks | 200 |
| GET | `/tasks/:id` | Get one task | 200, 404 |
| POST | `/tasks` | Create a task `{ "title": "..." }` | 201, 400 |
| PUT | `/tasks/:id` | Update title and/or done | 200, 400, 404 |
| DELETE | `/tasks/:id` | Delete a task | 204, 404 |
| GET | `/stats` | Total / done / open counts (SQL COUNT) | 200 |

### Query parameters (GET /tasks)

| Param | Example | SQL used |
|-------|---------|----------|
| `done` | `?done=true` | `WHERE done = ?` |
| `search` | `?search=milk` | `WHERE title LIKE ?` |

---

## Why SQLite?

- **Single file** — the entire database is `tasks.db` on disk; no server to run
- **Zero setup** — no install, no config, no username/password
- **Persistence** — data survives restarts (that's the whole point of Week 3)
- **Right tool** — perfect for a single-user dev API; you'd swap to Postgres when you need concurrent writers or a hosted cloud DB

`tasks.db` is listed in `.gitignore` so each fresh clone starts with a clean database that seeds itself.

---

## curl -i sample output

```
$ curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'

HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":4,"title":"Buy milk","done":false,"created_at":"2026-09-15 10:00:00"}
```

```
$ curl -i -X DELETE http://localhost:3000/tasks/2

HTTP/1.1 204 No Content
```

```
$ curl -i http://localhost:3000/tasks/999

HTTP/1.1 404 Not Found

{"error":"Task 999 not found"}
```

---



## SQL queries I ran in Stage 4 (DB Browser)

```sql
-- List all tasks
SELECT * FROM tasks;

-- Only completed tasks
SELECT * FROM tasks WHERE done = 1;

-- Count how many tasks exist
SELECT COUNT(*) FROM tasks;

-- Mark every task done
UPDATE tasks SET done = 1;

-- Delete all completed tasks
DELETE FROM tasks WHERE done = 1;
```

After running `UPDATE tasks SET done = 1` in DB Browser, I called `GET /tasks` from the API — every task came back as `"done": true` with zero server restart. The API and DB Browser are reading the exact same file — one source of truth.

---

## Stretch goals

- **SQL filtering** — `?done=true` uses `WHERE done = ?` in SQLite, not a JS loop
- **SQL search** — `?search=keyword` uses `WHERE title LIKE ?` with `%keyword%`
- **SQL stats** — `GET /stats` uses `SELECT COUNT(*), SUM(done)` — computed in the DB
- **Timestamps** — `created_at` column added to the schema (stored as ISO text)

### What adding `created_at` felt like

Adding the column required changing the `CREATE TABLE` statement and re-creating the database. On a real project with existing data you can't just drop the table — you'd write a **migration** (an ALTER TABLE script) to add the column safely. That's why migrations exist, and why every production backend has a migration tool.

---

## Proving the API didn't change

The same `curl` commands from Assignment 1 work unchanged against the SQLite version:

```bash
curl -i http://localhost:3000/tasks          # 200
curl -i http://localhost:3000/tasks/1        # 200
curl -i -X POST ... -d '{"title":"x"}'      # 201
curl -i -X PUT  ... -d '{"done":true}'      # 200
curl -i -X DELETE http://localhost:3000/tasks/1  # 204
```

Identical tests passing = proof that storage is "just an implementation detail." The API is the promise; the database is where the promise is kept. Swapping SQLite for Postgres tomorrow would require zero changes to the routes.

---

## Git commit history

```
Stage 0: create SQLite database
Stage 1: database read endpoints
Stage 2: insert into database
Stage 3: update and delete with SQL
Stage 4: explored SQLite
Stage 5: database documentation
Extras:  SQL filtering, search, stats, timestamps
```

---

## Tech

- **Runtime** — Node.js
- **Framework** — Express
- **Database** — SQLite via `better-sqlite3`
- **API docs** — swagger-ui-express + OpenAPI 3.0
- **Dev server** — nodemon
