from fastapi import FastAPI

#from controllers.customer_controller import router as customer_router
#from controllers.account_controller import router as account_router
from controllers.transaction_controller import router as transaction_router

app = FastAPI(title="Bank Management System API")

# Each controller module owns its own routes; main.py just registers
# them under the versioned prefix + tag from the roadmap spec.
# app.include_router(customer_router, prefix="/api/v1/customers", tags=["Customers"])
# app.include_router(account_router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(transaction_router, prefix="/api/v1/transactions", tags=["Transactions"])


@app.get("/", tags=["Health"])
def health_check():
    """Simple liveness check to confirm the API is up."""
    return {"status": "ok", "service": "Bank Management System API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)