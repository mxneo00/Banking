# 02 — Backend with REST API (CRUD, MVC Flow)

Stack: **FastAPI** (Python), layered / MVC-style architecture

## 🎯 Phase Goal

Architect a modular Python RESTful API using the Controller → Service →
Repository (MVC-style) pattern to handle CRUD operations for the Bank
Management System.

## 🛠️ Concepts & Topics Covered

* **Framework:** FastAPI, running on Uvicorn.
* **Architecture:** Controller/Router → Service/Logic → Repository/Data
  layer. Each layer only talks to the one directly below it — controllers
  never touch storage, and the repository never knows it's being used by
  a web API.
* **REST constraints:** `GET`, `POST`, `PUT`, `DELETE`; status codes
  `200`, `201`, `400`, `404`, `500`.
* **CRUD operations:** Customers, Accounts, Branches, and Transactions.
* **Automatic request validation:** Pydantic schemas + Python type hints,
  so FastAPI rejects malformed requests before a route function even runs.

## 📁 Project Structure

```
app/
├── controllers/
│   ├── branch_controller.py
│   ├── customer_controller.py
│   ├── account_controller.py
│   └── transaction_controller.py
├── services/
│   ├── branch_service.py
│   ├── customer_service.py
│   ├── account_service.py
│   └── transaction_service.py
├── models/
│   ├── domain.py
│   ├── repository.py
│   ├── exceptions.py
│   └── schemas.py
├── main.py
└── requirements.txt
```

This matches the roadmap's `controllers / services / models / main.py`
layout, with the Repository/Data layer implemented as `models/repository.py`
— an in-memory store today, swappable for a real database later without
touching `services/` or `controllers/`.

### What each file does

**`controllers/`** — one router per resource. Each file reads the
incoming request, calls a function in `services/`, and shapes the
response. No business rules live here.
* `branch_controller.py` — routes for creating/listing/getting branches.
* `customer_controller.py` — routes for the full customer CRUD set.
* `account_controller.py` — routes for opening accounts and listing/filtering them.
* `transaction_controller.py` — routes for deposit/withdraw/transfer and listing/filtering transactions.

**`services/`** — the business logic layer. Each file owns the rules for
one resource and is the only place those rules are enforced (e.g. "a
deactivated customer can't open a new account").
* `branch_service.py` — thin pass-through to the repository for branch operations.
* `customer_service.py` — create/list/get/update/deactivate logic, including the branch/customer filters used by the list endpoint.
* `account_service.py` — validates `account_type`, enforces the inactive-customer rule, and applies account filters (branch, customer, type, balance range).
* `transaction_service.py` — deposit/withdraw/transfer pass-through, plus date/type/account filters for the list endpoint.

**`models/`** — the schema and storage layer.
* `domain.py` — the core classes (`Customer`, `Account`, `SavingsAccount`, `CheckingAccount`, `Branch`, `Transaction`) plus their validation rules and `to_dict()` methods used to build JSON responses.
* `repository.py` — the in-memory Repository/Data layer: dictionaries and lists holding every branch, customer, account, and transaction, with plain storage methods (add/get/list). No business rules here — just storage.
* `exceptions.py` — the domain exceptions (`ValidationError`, `NotFoundError`, `DuplicateError`, `InsufficientFundsError`), framework-agnostic so the domain layer doesn't know it's running behind a web API.
* `schemas.py` — Pydantic classes used to validate incoming JSON request bodies (e.g. `CustomerCreate`, `AccountCreate`) before a route function runs.

**`main.py`** — the entry point. Creates the FastAPI app, registers all
four routers, and defines the exception handlers that turn a domain
exception (or a failed request validation) into the right HTTP status code.

## 📋 Roadmap & What Was Built

### Step 1: Project Architecture Setup
Directory layout matches the brief. Every request flows one direction:
`Controller → Service → Repository`, and every domain error flows back up
as an exception (`ValidationError`, `NotFoundError`, `DuplicateError`,
`InsufficientFundsError`) that `main.py` translates into an HTTP status
code — no route handles status codes itself.

### Step 2: Core Banking CRUD Endpoints

**Customers**
| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/customers` | Create customer profile |
| `GET` | `/api/v1/customers` | List customers |
| `GET` | `/api/v1/customers/{id}` | Get customer details |
| `PUT` | `/api/v1/customers/{id}` | Update name and/or email (partial update) |
| `DELETE` | `/api/v1/customers/{id}` | Deactivate (soft-delete) — record and history are kept, `is_active` flips to `false` |

**Accounts & Transactions**
| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/accounts` | Open a new account (`account_type`: `"savings"` or `"checking"`) |
| `POST` | `/api/v1/transactions/transfer` | Process a money transfer between two accounts |

Two endpoints beyond the brief were added because a transfer-only API is
hard to test in isolation, and because "Managing... Transactions" implies
more than transfers alone:
| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/transactions/deposit` | Deposit into a single account |
| `POST` | `/api/v1/transactions/withdraw` | Withdraw from a single account |

A minimal **Branches** endpoint set was also added as a prerequisite —
customers must reference an existing `branch_id`, so branches need a way
to be created first:
| Method | Path |
|---|---|
| `POST` | `/api/v1/branches` |
| `GET` | `/api/v1/branches` |
| `GET` | `/api/v1/branches/{branch_code}` |

Plus a single-resource lookup for convenience:
`GET /api/v1/accounts/{account_number}`

### Step 3: Filtering & Search
```
GET /api/v1/accounts?branch_id=BR001&min_balance=1000
GET /api/v1/transactions?start_date=2026-01-01&type=TRANSFER
```
Also supported: `customer_id` and `account_type` on accounts;
`end_date` and `account_number` on transactions. Query params are typed
(`Optional[float]`, `Optional[date]`, etc.) in the controller functions,
so FastAPI parses and validates them automatically — an invalid
`min_balance` or malformed date returns `400` before any service code runs.

## Status Code Reference

| Situation | Code |
|---|---|
| Resource created | `201` |
| Successful read / update / delete | `200` |
| Bad input, duplicate ID, insufficient funds, failed validation | `400` |
| Resource or route not found | `404` |
| Unhandled server error | `500` |

FastAPI's default for a failed request validation is `422`; `main.py`
overrides that so every failure path in this API uses the status codes
above consistently.

## Setup & Run

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

API: `http://127.0.0.1:8000`
Interactive docs (free with FastAPI): `http://127.0.0.1:8000/docs`

## Quick Test

```bash
curl -X POST http://127.0.0.1:8000/api/v1/branches \
  -H "Content-Type: application/json" \
  -d '{"branch_code": "BR001", "location": "Downtown", "manager_id": "MGR-01"}'

curl -X POST http://127.0.0.1:8000/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "CUST-01", "name": "Aisha Khan", "email": "aisha@example.com", "branch_id": "BR001"}'

curl -X POST http://127.0.0.1:8000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "CUST-01", "account_type": "savings", "opening_balance": 1000}'

curl "http://127.0.0.1:8000/api/v1/accounts?branch_id=BR001&min_balance=500"
```

## Notes for Reviewers / Next Iteration

* **Storage is in-memory** (`models/repository.py`) — data resets on
  restart. Swapping in a real database is the natural next step, and
  shouldn't require touching `services/` or `controllers/` at all, since
  they only ever call methods like `repository.get_customer(id)`.
* **No auth yet.** Every endpoint is open. Worth flagging for a future
  phase if this API needs to be exposed beyond the workshop.
