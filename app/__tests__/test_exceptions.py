"""Tests for app/models/exceptions.py -- the domain exception hierarchy."""

import pytest

from models.exceptions import (
    BankingError,
    DuplicateError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
)


@pytest.mark.parametrize(
    "exc_class",
    [ValidationError, DuplicateError, NotFoundError, InsufficientFundsError],
)
def test_every_domain_exception_subclasses_banking_error(exc_class):
    assert issubclass(exc_class, BankingError)


@pytest.mark.parametrize(
    "exc_class",
    [BankingError, ValidationError, DuplicateError, NotFoundError, InsufficientFundsError],
)
def test_every_domain_exception_subclasses_exception(exc_class):
    assert issubclass(exc_class, Exception)


def test_banking_error_can_be_raised_and_caught_with_a_message():
    with pytest.raises(BankingError, match="boom"):
        raise BankingError("boom")


@pytest.mark.parametrize(
    "exc_class",
    [ValidationError, DuplicateError, NotFoundError, InsufficientFundsError],
)
def test_subclasses_are_catchable_as_banking_error(exc_class):
    """main.py registers one handler per subclass, but each should also be
    catchable via the shared BankingError base, matching how @app.exception_handler
    resolution falls back for uncaught BankingError subtypes."""
    with pytest.raises(BankingError):
        raise exc_class("something went wrong")


def test_distinct_exception_types_are_not_interchangeable():
    with pytest.raises(ValidationError):
        raise ValidationError("bad input")

    with pytest.raises(NotFoundError):
        raise NotFoundError("missing record")

    # Sibling subclasses must not satisfy each other's type checks.
    assert not issubclass(ValidationError, NotFoundError)
    assert not issubclass(NotFoundError, ValidationError)
    assert not isinstance(ValidationError("bad input"), NotFoundError)
