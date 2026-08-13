# Bank Management System

A RESTful banking API built with FastAPI, backed by Postgres, with JWT
authentication and role-based access control, plus a React + TypeScript
frontend for both customers and staff. Built in phases as part of
a team training workshop — the phase history is below the current-state
summary.

---

## Table of Contents

* [Current State](#current-state)
  * [Stack](#stack)
  * [Architecture](#architecture)
  * [API Overview](#api-overview)
  * [Running Locally](#running-locally)
  * [Frontend](#frontend)
  * [Seed / Demo Login Credentials](#seed--demo-login-credentials)
  * [Running Tests](#running-tests)
  * [Known Gaps](#known-gaps)
* [Phase History](#phase-history)
  * [Phase 02 — Backend REST API (CRUD, MVC Flow)](#phase-02--backend-rest-api-crud-mvc-flow)
  * [Database Integration — Postgres](#database-integration--postgres)
  * [Auth & Security](#auth--security)
  * [Testing — Unit Tests & Postman (in progress)](#testing--unit-tests--postman-in-progress)

---

## Current State

### Stack

* **Framework:** FastAPI on Uvicorn
* **Database:** Postgres, via SQLAlchemy ORM (`psycopg` driver)
* **Auth:** JWT (access + refresh tokens), `bcrypt` password hashing, role-based access control
* **Testing:** `pytest`
* **Frontend:** React 19 + TypeScript, Vite, MUI, React Router, Axios (see [Frontend](#frontend) below)

### Architecture

Controller → Service → Database, each layer only talking to the one
directly below it:

```
app/
├── controllers/        # routing/HTTP only — no business logic
│   ├── authController.py
│   ├── customerController.py
│   ├── accountController.py
│   ├── transactionController.py
│   └── budgetController.py
├── services/            # business logic; talks to Postgres via a SQLAlchemy Session
│   ├── authService.py
│   ├── customerService.py
│   ├── accountService.py
│   ├── transactionService.py
│   └── budgetService.py
├── security/             # password hashing + JWT creation/decoding, framework-agnostic
│   ├── passwords.py
│   ├── tokens.py
│   └── dependencies.py   # FastAPI auth/RBAC dependencies (get_current_user, require_roles)
├── models/
│   ├── database.py       # SQLAlchemy models + engine/session — the real source of truth
│   ├── schemas.py         # Pydantic request/response models
│   ├── exceptions.py
│   ├── domain.py          # legacy in-memory domain classes — see note below
│   └── repository.py      # legacy in-memory data layer — not used by the running app; see note below
├── __tests__/
├── seedData.py
└── main.py
```

> **Note on `domain.py` / `repository.py`:** these were the original
> in-memory storage layer from the project's first phase. Every resource
> (customers, accounts, transactions, users) has since moved to Postgres
> via `models/database.py`, and nothing in the live app calls into these
> two files anymore. Kept for now as reference rather than deleted outright.

### API Overview

| Resource | Endpoints |
|---|---|
| **Auth** (`/api/v1/auth`) | `POST /register` (self-signup), `POST /login`, `POST /refresh`, `GET /me`, `POST /logout`, `POST /staff` (admin-only) |
| **Customers** (`/api/v1/customers`) | `POST /`, `GET /`, `GET /{customer_id}`, `PUT /{customer_id}`, `DELETE /{customer_id}` (deactivate) |
| **Accounts** (`/api/v1/accounts`) | `POST /` (open savings/checking), `GET /{account_number}` |
| **Transactions** (`/api/v1/transactions`) | `POST /` (deposit/withdraw), `POST /transfer`, `GET /`, `GET /{transaction_id}` |
| **Budgets** (`/api/v1/budgets`) | `POST /` (create), `GET /` (list, supports period filtering), `PUT /{budget_id}`, `DELETE /{budget_id}` |

Every endpoint except `/api/v1/auth/register` and `/api/v1/auth/login`
requires a Bearer access token. Four roles exist: `customer`, `teller`,
`branch_manager`, `admin` — customers can only reach their own data;
staff roles can act on any customer's.

### Running Locally

1. **Postgres** — either a local install or a container; nothing in this
   project requires Docker specifically. Create a database and user for it.
2. **Environment** — copy `.env.example` to `.env` and fill in
   `DATABASE_URL` plus the JWT settings (`JWT_SECRET_KEY` especially —
   never reuse the placeholder value outside local dev).
3. **Install dependencies:**
   ```
   pip install -r requirements.txt
   pip install -r requirements-dev.txt   # adds pytest, httpx (for tests)
   ```
4. **Run the API** (from inside `app/`):
   ```
   uvicorn main:app --reload
   ```
   Then visit `http://127.0.0.1:8000/docs` for interactive Swagger UI.
   On first startup, the app creates its tables and seeds demo customers,
   accounts, and staff logins — see [Seed / Demo Login Credentials](#seed--demo-login-credentials)
   below (change these before using this project anywhere beyond local dev).

### Frontend

A React + TypeScript single-page app under [`frontend/`](frontend/), built
with Vite and MUI, serving both the customer portal and the staff portal
from one app (route access is gated by role — see `App.tsx`).

```
frontend/src/
├── api/            # axios calls per resource (auth, customers, accounts, transactions, budgets)
├── components/     # route guards (GuestRoute, ProtectedRoute, CustomerRoute, StaffRoute) + shared UI
├── context/         # AuthContext — current user/session state
├── layouts/          # AppLayout (shared nav/shell for authenticated routes)
├── pages/
│   ├── LoginPage.tsx / RegisterPage.tsx      # customer self-service auth
│   ├── DashboardPage.tsx / AccountPage.tsx    # customer: account overview + detail
│   ├── BudgetPage.tsx                          # customer: budget CRUD + allocation chart, period filtering
│   ├── StaffDashboardPage.tsx                  # staff landing page
│   ├── CashDeskPage.tsx                        # staff: deposits/withdrawals at a branch desk
│   ├── StaffTransactionsPage.tsx               # staff: transaction lookup across customers
│   └── AnalyticsPage.tsx                       # staff: branch/staff analytics
├── theme/          # MUI theme
└── types/          # request/response types, split by resource
```

**Running it** (from `frontend/`):
```
npm install
npm run dev
```
Then visit `http://localhost:5173`. The dev server expects the backend
API to be running at `http://127.0.0.1:8000` (see `src/api/client.ts`);
the backend's `CORS_ORIGINS` must include `http://localhost:5173` for
requests to succeed (already the default in `.env.example`).

### Seed / Demo Login Credentials

On first startup (empty `users` table), the backend seeds one admin plus
a teller and branch manager so every role can be exercised immediately
from the frontend's `/login` page — the dashboard shown after login is
based on the account's role. **Change or remove these before deploying
anywhere beyond local dev.**

| Role | Email | Password | Branch |
|---|---|---|---|
| Admin | `admin@bank.local` | `admin123` | — |
| Teller | `teller@bank.local` | `teller123` | `BR001` |
| Branch Manager | `manager@bank.local` | `manager123` | `BR001` |

Customers aren't seeded — register one via `/register` (self-signup) or
`POST /api/v1/auth/register`.

### Running Tests

From the project root:
```
pytest
```
Tests that touch the database (most service-layer tests) require Postgres
to be running and reachable via `DATABASE_URL`. A few pure-logic test
files (password hashing, JWT creation) are marked `@pytest.mark.no_db` and
skip the database fixture entirely.

### Known Gaps

* **Branches aren't a real table yet.** `branch_id` on customers/accounts
  is a plain string with no foreign key and, currently, no validation
  against a real set of branches — worth deciding whether branches need
  their own Postgres table or should be dropped as a concept.
* **`reset_db()` / `reset_and_seed_db()`** are manual dev-only tools for
  wiping and rebuilding the schema — never wired into app startup, and
  guarded with a `confirm=True` requirement to avoid accidental use.
* **API-level (Postman) testing** is in progress as part of the current
  testing phase; unit test coverage exists for auth, accounts, and
  transactions so far.

---

## Phase History

### Phase 02 — Backend REST API (CRUD, MVC Flow)

**Goal:** architect a modular Python REST API using Controller → Service →
Repository (MVC-style) to handle CRUD for the Bank Management System.

* FastAPI + Uvicorn; layered architecture where each layer only talks to
  the one directly below it — controllers never touch storage directly.
* REST conventions: `GET`/`POST`/`PUT`/`DELETE`, status codes
  `200`/`201`/`400`/`404`/`500`.
* CRUD for customers, accounts, branches, and transactions.
* Request validation via Pydantic schemas + FastAPI, rejecting malformed
  requests before a route function runs.
* Storage was `models/repository.py` — a single in-memory Python
  dictionary per resource, explicitly designed to be swapped for a real
  database later without changing `services/` or `controllers/`.

### Database Integration — Postgres

**Goal:** replace the in-memory repository with real, persistent storage.

* Customers, accounts, and transactions each moved to SQLAlchemy models
  backed by Postgres, one resource at a time rather than all at once.
* `Account.customer_id` became a real foreign key onto
  `customers.customer_id`, which meant getting seeding order right —
  customers must exist before any account referencing them is inserted,
  or Postgres rejects the insert outright.
* `CustomerDB.accounts` is a SQLAlchemy `relationship`, not a stored
  column — a customer's account list is computed via a live join rather
  than kept as a separately-maintained list that could go stale.
* Local dev setup was tried both via Docker Compose and a native Postgres
  install; the team settled on each person running their own local
  Postgres, since it's simpler for a project this size and sidesteps
  Docker-specific issues (e.g. virtualization not being available on
  every machine).
* Lesson learned the hard way: Postgres doesn't reset when you switch git
  branches. Two branches with different, incompatible table definitions
  sharing one local database caused real "table already exists" and
  schema-mismatch errors — solved by keeping schemas consistent across
  branches rather than isolating every branch into its own database.

### Auth & Security

**Goal:** add real authentication and role-based authorization.

* `security/passwords.py` — `bcrypt` password hashing (chosen over the
  `passlib` wrapper, which is unmaintained and breaks on `bcrypt>=4.1`).
* `security/tokens.py` — JWT access tokens (short-lived) and refresh
  tokens (longer-lived), with a `type` claim so one can never be used in
  place of the other.
* `security/dependencies.py` — `get_current_user` (resolves the caller's
  identity from their Bearer token) and `require_roles(...)` (a
  dependency factory for RBAC), plus `ensure_self_or_staff` for
  "customers can only touch their own data" checks.
* Real logout: a `token_version` column on each user, bumped on logout,
  invalidates every previously issued token (access and refresh, every
  session) immediately — no denylist table required.
* Login returns the same `401` for "no such email" and "right email,
  wrong password," so the endpoint can't be used to enumerate registered
  emails.
* Admin bootstrap problem solved: creating a staff account normally
  requires an existing admin to authorize it, so exactly one admin login
  is seeded directly on first startup to break the chicken-and-egg
  problem.

### Testing — Unit Tests & Postman (in progress)

**Goal:** ensure service reliability and correct logic enforcement via
automated unit tests and API-level verification.

* Unit tests for `authService` (registration, login, token refresh,
  logout, staff creation) hit a real Postgres test database, reset and
  reseeded between tests via a shared `pytest` fixture.
* Pure-logic tests for password hashing and JWT creation/decoding run
  without a database at all, via a `@pytest.mark.no_db` opt-out of that
  fixture.
* Postman collection (environment variables, request scripts, response
  assertions) — not yet built.