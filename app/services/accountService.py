""" Business logic for opening and reading accounts """

from models.domain import CheckingAccount, SavingsAccount
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
    branch = repository.get_branch(customer.branch_id)
    number = repository.next_account_number()

    # None means the client omitted the setting, so the account class keeps its
    # own default (100.0 for savings, 500.0 for checking).
    if account_type == "savings":
        if minimum_balance is None:
            account = SavingsAccount(
                number, customer.customer_id, branch.branch_code, opening_balance
            )
        else:
            account = SavingsAccount(
                number, customer.customer_id, branch.branch_code,
                opening_balance, minimum_balance,
            )
    else:
        if overdraft_limit is None:
            account = CheckingAccount(
                number, customer.customer_id, branch.branch_code, opening_balance
            )
        else:
            account = CheckingAccount(
                number, customer.customer_id, branch.branch_code,
                opening_balance, overdraft_limit,
            )

    # Validate first, then write: these three updates complete registration.
    repository.add_account(account)
    customer.add_account(account.account_number)
    branch.add_account(account.account_number)
    return account

