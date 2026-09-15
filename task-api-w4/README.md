# Auth API — FlyRank Backend Track · Week 2 · A4

Secure REST API built with **Node.js + Express** and **Supabase Auth**.  
Handles Sign Up, Log In, Log Out, and guards private endpoints with JWT verification middleware.

---

## What this project is

A stateless API that delegates user authentication to Supabase as an Identity Provider. Your server never stores passwords — Supabase hashes them and issues signed JWTs. Your backend's only job is to:

1. Forward credentials to Supabase
2. Receive the JWT back
3. Verify that JWT on every protected request using a single reusable middleware guard

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/auth-api.git
cd auth-api
npm install
```

### 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → create a free project
2. Open **Project Settings → API** and copy your **Project URL** and **anon key**
3. Go to **Authentication → Sign In / Providers → Email** and **turn off "Confirm email"** (for dev)

### 3. Set up environment variables

```bash
cp .env.example .env
```

Then open `.env` and fill in your real values:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-anon-public-key-here
PORT=3000
```

> ⚠️ Never commit `.env`. It's already in `.gitignore`.

### 4. Run the server

```bash
npm start
# or for auto-reload during dev:
npm run dev
```

Server logs:
```
✅  Server running on http://localhost:3000
📖  Swagger docs  → http://localhost:3000/docs
🔑  Connected to Supabase: https://xxx.supabase.co
```

---

## API Reference

| Method | Endpoint | Auth Required | Description | Success |
|--------|----------|:-------------:|-------------|---------|
| `GET` | `/public/info` | ❌ No | Public welcome message | 200 |
| `POST` | `/auth/signup` | ❌ No | Create a new account | 201 |
| `POST` | `/auth/login` | ❌ No | Authenticate & get JWT | 200 |
| `POST` | `/auth/logout` | ✅ Yes | End session | 204 |
| `GET` | `/protected/profile` | ✅ Yes | Read private user data | 200 |
| `GET` | `/protected/dashboard` | ✅ Yes | Read private dashboard | 200 |

**Auth header format for protected routes:**
```
Authorization: Bearer <your_access_token>
```

**Error responses** always return JSON:
```json
{ "error": "Description of what went wrong" }
```

**Status codes used:**
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created (signup success) |
| 204 | No Content (logout success) |
| 400 | Bad Request — missing email or password |
| 401 | Unauthorized — missing, malformed, or expired token |
| 403 | Forbidden — authenticated but not allowed |

---

## Testing with curl

**Full happy path:**

```bash
# 1. Sign up
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# → 201

# 2. Log in — copy the access_token from the response
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# → 200 + access_token

# 3. Access protected profile (paste your token)
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
# → 200 + user data

# 4. Tamper the token — one character changed
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <YOUR_TOKEN_BUT_LAST_CHAR_CHANGED>"
# → 401 Invalid or expired token

# 5. Logout
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
# → 204

# 6. Public route — no token needed
curl -i http://localhost:3000/public/info
# → 200
```

---

## Swagger UI

Open **http://localhost:3000/docs** in your browser.

1. Click **Authorize 🔒**
2. Paste your `access_token` from `/auth/login`
3. Click **Try it out** on any protected route — no curl needed


---

## Project structure

```
auth-api/
├── server.js               ← Entry point: Express app, routes, Swagger
├── supabaseClient.js       ← Single Supabase client (reads from .env)
├── middleware/
│   └── authGuard.js        ← Reusable JWT verification middleware
├── routes/
│   ├── auth.js             ← POST /auth/signup, /login, /logout
│   ├── protected.js        ← GET /protected/profile, /dashboard
│   └── public.js           ← GET /public/info
├── openapi.json            ← OpenAPI 3.0 spec with BearerAuth scheme
├── .env.example            ← Key names with placeholder values (safe to commit)
├── .gitignore              ← Ignores .env and node_modules
└── README.md
```

---

## How the auth flow works

```
Client              Your Server         Supabase
  │                     │                   │
  │── POST /auth/login ─►│                   │
  │                     │── signInWithPwd ──►│
  │                     │◄── JWT ────────────│
  │◄── access_token ────│                   │
  │                     │                   │
  │── GET /protected ──►│                   │
  │   Authorization:    │── getUser(jwt) ──►│
  │   Bearer <token>    │◄── user ───────────│
  │◄── 200 user data ───│                   │
```

The `authGuard` middleware sits between the request and the route handler. It verifies the token with Supabase before the route body ever runs.

---

## The 401 vs 403 difference

| Code | Meaning | When |
|------|---------|------|
| **401** Unauthorized | "I don't know who you are" | Token missing, malformed, or expired |
| **403** Forbidden | "I know who you are — and still no" | Valid token, but user lacks permission |

A 403 would apply if you added role-based access: e.g. an `/admin` route that's accessible only to users with `role: admin` in their JWT metadata. A regular logged-in user would get 401 on a public route (no token) but **403** on the admin route (valid token, wrong role).

---

*FlyRank Backend Track · Week 2 · Assignment A4*
