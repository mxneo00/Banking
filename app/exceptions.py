"""Custom exceptions for the banking MVP.

Every error raised by the domain layer inherits from BankingError, so the
console application can catch one type and still print a useful message.
"""


class BankingError(Exception):
    """Base class for every error the banking domain raises."""


class ValidationError(BankingError):
    """Input failed a business rule (bad amount, bad email, empty field)."""


class DuplicateError(BankingError):
    """An identifier is already in use (customer, branch, account, staff)."""


class NotFoundError(BankingError):
    """A requested customer, branch, or account does not exist."""


class InsufficientFundsError(BankingError):
    """A withdrawal was rejected by the account's own withdrawal rule."""
