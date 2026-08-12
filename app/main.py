""" Entry point for the Bank Management REST API.

Run with:      uvicorn main:app --reload 
Alternative run with: python -m uvicorn main:app --reload
Then visit:    http://127.0.0.1:8000/docs   (interactive Swagger UI, free with FastAPI)

This file wires the three layers together:
    Controllers (routing/HTTP)  -->  Services (business logic)  -->  Repository (storage)
and is the one place that knows how to turn a domain exception (or a failed request validation) into an HTTP status code, so no individual route has to think about that itself.
"""

import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from controllers.accountController import router as account_router
from controllers.authController import router as auth_router
from controllers.customerController import router as customer_router
from controllers.transactionController import router as transaction_router

from models.exceptions import (
    BankingError,
    DuplicateError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
)

app = FastAPI(title="Bank Management API")

#app.include_router(branch_router)  # NOTE: branch_router doesn't exist -- no branchController.py in this project
app.include_router(auth_router)
app.include_router(customer_router)
app.include_router(account_router)
app.include_router(transaction_router)

# CORS configuration: allow requests from the frontend (e.g., Vite dev server at localhost:5173)
# CORS_ORIGINS is a comma-separated list of allowed origins, defaulting to http://localhost:5173 if not set in the environment.
_cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,  # Adjust this to your frontend's origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    """Create Postgres tables and seed demo customers + accounts + one admin.

    Order matters: customers before accounts (Account.customer_id is a real
    FK onto customers.customer_id), and the admin seed is independent but
    grouped here for the same "get a working demo state on first run"
    reason. seedData.py's in-memory repository seeding was retired:
    customerService/accountService are fully Postgres-backed now, so
    nothing reads that in-memory store anymore.
    """
    from models.database import init_db, seed_demo_accounts, seed_demo_admin, seed_demo_customers, seed_demo_staff

    init_db()
    seed_demo_customers()
    seed_demo_accounts()
    seed_demo_admin()
    seed_demo_staff()

""" 
Error handlers: map each domain exception (and FastAPI's own request validation errors) to the HTTP status code it should produce.
"""

@app.exception_handler(NotFoundError)
async def handle_not_found(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"error": "NotFound", "message": str(exc)})

@app.exception_handler(DuplicateError)
async def handle_duplicate(request: Request, exc: DuplicateError):
    return JSONResponse(status_code=400, content={"error": "Duplicate", "message": str(exc)})

@app.exception_handler(InsufficientFundsError)
async def handle_insufficient_funds(request: Request, exc: InsufficientFundsError):
    return JSONResponse(status_code=400, content={"error": "InsufficientFunds", "message": str(exc)})

@app.exception_handler(ValidationError)
async def handle_validation(request: Request, exc: ValidationError):
    return JSONResponse(status_code=400, content={"error": "Validation", "message": str(exc)})

@app.exception_handler(BankingError)
async def handle_banking_error(request: Request, exc: BankingError):
    return JSONResponse(status_code=400, content={"error": "BankingError", "message": str(exc)})

@app.exception_handler(RequestValidationError)
async def handle_request_validation(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": "RequestValidationError", "message": str(exc)})

@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": "HTTPException", "message": str(exc.detail)})

@app.exception_handler(Exception)
async def handle_generic_exception(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": "InternalServerError", "message": str(exc)})