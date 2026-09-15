# Task API — v3 (PostgreSQL + Docker)

FlyRank Internship · Backend Track · Week 4 · Assignment A3

Same five endpoints. Third storage engine. One command starts everything.

| Assignment | Storage | Restart? |
|---|---|---|
| A1 | In-memory array | Data lost 💀 |
| A2 | SQLite file (`tasks.db`) | Data survives ✅ |
| A3 (this) | PostgreSQL in Docker | Data survives ✅ + runs anywhere |

---

## One-command startup

```bash
cp .env.example .env          # first time only
docker compose up             # starts API + Postgres together
```

`tasks.db` is gone. `tasks.db` was SQLite — Postgres runs as its own container now.  
All data lives in a Docker **volume** (`taskdata`) so it survives `docker compose down && up`.

Stop everything:
```bash
docker compose down           # keeps data
docker compose down -v        # wipes volume (fresh start)
```

---

## Environment variables

Copy `.env.example` → `.env` and set:

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:dev@localhost:5432/tasks` | Postgres connection string |
| `PORT` | `3000` | API port (optional, defaults to 3000) |

> ⚠️ `.env` is **git-ignored**. Never commit real passwords.  
> `.env.example` is committed — it shows which keys to set, with placeholders only.

---

## Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| GET | `/` | API info | 200 |
| GET | `/health` | Health check (pings DB) | 200, 503 |
| GET | `/tasks` | List all tasks | 200 |
| GET | `/tasks/:id` | Get one task | 200, 404 |
| POST | `/tasks` | Create `{ "title": "..." }` | 201, 400 |
| PUT | `/tasks/:id` | Update title / done | 200, 400, 404 |
| DELETE | `/tasks/:id` | Delete a task | 204, 404 |
| GET | `/stats` | Total / done / open (SQL COUNT FILTER) | 200 |

### Query parameters (GET /tasks)

| Param | Example | SQL |
|---|---|---|
| `done` | `?done=true` | `WHERE done = $1` |
| `search` | `?search=milk` | `WHERE title ILIKE $1` |

---

## curl -i sample output

```
$ curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'

HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":4,"title":"Buy milk","done":false,"created_at":"2026-09-15T10:00:00.000Z"}
```

```
$ curl -i http://localhost:3000/tasks/999

HTTP/1.1 404 Not Found

{"error":"Task 999 not found"}
```

```
$ curl -i -X DELETE http://localhost:3000/tasks/1

HTTP/1.1 204 No Content
```

---


## Why Postgres over SQLite?

| | SQLite | PostgreSQL |
|---|---|---|
| Setup | Zero — single file | Runs as its own server (Docker) |
| Concurrent writers | Limited | Unlimited |
| Data types | Loose typing | Strict, rich types |
| Used in production | Small/embedded apps | Most of the world's backends |
| FlyRank uses | — | ✅ |

SQLite was perfect for a single-developer dev tool. Postgres is what you'd actually deploy — and Docker makes it just as easy to run locally.

---

## How the storage swap works

The same `curl` commands from A1 work unchanged on Postgres:

```bash
curl -i http://localhost:3000/tasks          # 200
curl -i http://localhost:3000/tasks/1        # 200
curl -i -X POST ... -d '{"title":"x"}'      # 201
curl -i -X PUT  ... -d '{"done":true}'      # 200
curl -i -X DELETE http://localhost:3000/tasks/1  # 204
```

Three storage engines. Zero route changes. Storage is "just an implementation detail" — the API is the promise; the database is just where the promise is kept.

---

## Key differences: SQLite → Postgres

| | SQLite (`better-sqlite3`) | Postgres (`pg`) |
|---|---|---|
| Queries | Synchronous | Async/await |
| Placeholders | `?` | `$1, $2, $3` |
| Auto-increment | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| Boolean | Stored as 0/1 | Native `BOOLEAN` |
| Get inserted row | Query again by rowid | `INSERT … RETURNING *` |
| Case-insensitive search | `LIKE` | `ILIKE` |

---

## Stretch goals

- **Real health check** — `GET /health` pings `SELECT 1` and returns `{ db: "ok" }` or `503`. Load balancers use this to know when to route traffic.
- **SQL stats** — `GET /stats` uses `COUNT(*) FILTER (WHERE done)` — computed in the DB
- **ILIKE search** — `?search=milk` uses Postgres `ILIKE` (case-insensitive, no extra code)
- **Multi-stage Dockerfile** — builder stage installs deps, final image copies only what's needed (smaller image)
- **depends_on healthcheck** — `api` waits for `db` to pass `pg_isready` before starting

---

## Git commit history

```
Stage 0: Postgres in Docker + gitignore
Stage 1: connect via .env and create table
Stage 2: read from Postgres
Stage 3: full CRUD on Postgres
Stage 4: docker-compose the whole stack
Stage 5: one-command stack + docs
Extras:  health DB ping, stats FILTER, ILIKE, multi-stage Dockerfile
```

---

## Tech

- **Runtime** — Node.js 20
- **Framework** — Express
- **Database** — PostgreSQL 16 (Docker)
- **Driver** — `pg` (node-postgres)
- **Container** — Docker + Compose
- **API docs** — swagger-ui-express + OpenAPI 3.0
