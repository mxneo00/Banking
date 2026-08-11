""" Business logic for opening and reading accounts """

from models.exceptions import ValidationError
from models.repository import repository


def open_account(customer_id, account_type, opening_balance=0.0,
                 minimum_balance=None, overdraft_limit=None):
    """Open a savings or checking account for an existing, active customer."""
    if account_type not in ("savings", "checking"):
        raise ValidationError(
            f"account_type must be 'savings' or 'checking', got '{account_type}'."
        )

    customer = repository.get_customer(customer_id)
    if not customer.is_active:
        raise ValidationError(
            f"Customer '{customer_id}' is deactivated and cannot open new accounts."
        )

    # Branch is derived from the customer — callers never send it.
    # None means the client omitted the setting, so the account class keeps its
    # own default (100.0 for savings, 500.0 for checking).
    if account_type == "savings":
        if minimum_balance is None:
            return repository.open_savings_account(customer_id, opening_balance)
        return repository.open_savings_account(
            customer_id, opening_balance, minimum_balance
        )

    if overdraft_limit is None:
        return repository.open_checking_account(customer_id, opening_balance)
    return repository.open_checking_account(
        customer_id, opening_balance, overdraft_limit
    )
