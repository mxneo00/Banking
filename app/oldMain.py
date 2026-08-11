"""Menu-driven console front end for the banking MVP.

This layer only reads input, prints output, and calls Bank methods. It contains
no business rules: it never adds to a balance or builds a Transaction itself.
Run it with:  python main.py
"""

from datetime import datetime

from bank import Bank
from exceptions import BankingError
from models import Branch, Customer, to_money

SEPARATOR = "-" * 62


class BankingApplication:
    """Draws the menu, collects input, and delegates work to the Bank."""

    def __init__(self, bank=None):
        # Optional parameter with a meaningful default: normally the app makes
        # its own Bank, but a test can hand it a pre-filled one.
        self.bank = bank if bank is not None else Bank("MVP Bank")
        self._running = True

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    def run(self):
        print(f"\nWelcome to {self.bank.name}")
        print("Tip: choose option 0 first to load demonstration data.\n")
        actions = {
            "0": self.load_demo_data,
            "1": self.create_branch,
            "2": self.register_customer,
            "3": self.open_savings_account,
            "4": self.open_checking_account,
            "5": self.deposit_funds,
            "6": self.withdraw_funds,
            "7": self.transfer_funds,
            "8": self.show_account,
            "9": self.list_branch_accounts,
            "10": self.monthly_volume_report,
            "11": self.ratio_report,
            "12": self.exit_app,
        }
        while self._running:
            self._print_menu()
            choice = self._ask("Choose an option: ")
            if choice is None:
                self.exit_app()
                break
            action = actions.get(choice.strip())
            if action is None:
                print("Please enter a number from the menu (0-12).")
                continue
            try:
                action()
            except BankingError as error:
                # Every domain rule failure lands here with a readable message.
                print(f"Error: {error}")
            except EOFError:
                self.exit_app()
                break

    @staticmethod
    def _print_menu():
        print(f"\n{SEPARATOR}")
        print(" 0. Load demonstration data")
        print(" 1. Create a branch")
        print(" 2. Register a customer")
        print(" 3. Open a savings account")
        print(" 4. Open a checking account")
        print(" 5. Deposit funds")
        print(" 6. Withdraw funds")
        print(" 7. Transfer funds")
        print(" 8. Display an account and its balance")
        print(" 9. List accounts for a branch")
        print("10. Calculate monthly transaction volume for a branch")
        print("11. Find branches above a staff-to-manager ratio")
        print("12. Exit")
        print(SEPARATOR)

    # ------------------------------------------------------------------
    # Input helpers: these keep bad typing from crashing the program
    # ------------------------------------------------------------------
    @staticmethod
    def _ask(prompt):
        """Read one line. Returns None if the input stream ends (Ctrl+Z / pipe)."""
        try:
            return input(prompt)
        except EOFError:
            return None

    def _ask_text(self, prompt):
        """Keep asking until the user types something that is not blank."""
        while True:
            answer = self._ask(prompt)
            if answer is None:
                return None
            if answer.strip():
                return answer.strip()
            print("This field cannot be empty. Please try again.")

    def _ask_money(self, prompt):
        """Read a monetary value; re-prompt on anything that is not a number."""
        while True:
            answer = self._ask(prompt)
            if answer is None:
                return None
            try:
                return to_money(answer, "Amount")
            except BankingError as error:
                print(f"Error: {error}")

    def _ask_int(self, prompt):
        while True:
            answer = self._ask(prompt)
            if answer is None:
                return None
            try:
                return int(answer.strip())
            except ValueError:
                print("Please enter a whole number.")

    def _ask_float(self, prompt):
        while True:
            answer = self._ask(prompt)
            if answer is None:
                return None
            try:
                return float(answer.strip())
            except ValueError:
                print("Please enter a number, for example 2 or 2.5.")

    def _ask_optional_money(self, prompt, default):
        """Read a value that may be left blank to accept `default`."""
        while True:
            answer = self._ask(f"{prompt} [default {default}]: ")
            if answer is None:
                return None
            if not answer.strip():
                return default
            try:
                return to_money(answer, "Amount")
            except BankingError as error:
                print(f"Error: {error}")

    # ------------------------------------------------------------------
    # Menu actions
    # ------------------------------------------------------------------
    def create_branch(self):
        code = self._ask_text("Branch code: ")
        location = self._ask_text("Location: ")
        manager_id = self._ask_text("Manager ID: ")
        if not (code and location and manager_id):
            return
        branch = self.bank.add_branch(Branch(code, location, manager_id))
        print(f"Created branch {branch.branch_code} in {branch.location}.")

        while True:
            staff_id = self._ask("Add staff ID (blank to finish): ")
            if staff_id is None or not staff_id.strip():
                break
            try:
                self.bank.add_staff(branch.branch_code, staff_id)
                print(f"Added staff {staff_id.strip()}.")
            except BankingError as error:
                print(f"Error: {error}")
        print(branch.describe())

    def register_customer(self):
        customer_id = self._ask_text("Customer ID: ")
        name = self._ask_text("Name: ")
        email = self._ask_text("Email: ")
        branch_id = self._ask_text("Branch code: ")
        if not (customer_id and name and email and branch_id):
            return
        customer = self.bank.add_customer(Customer(customer_id, name, email, branch_id))
        print(f"Registered customer {customer.customer_id} ({customer.name}).")

    def open_savings_account(self):
        customer_id = self._ask_text("Customer ID: ")
        if customer_id is None:
            return
        opening = self._ask_optional_money("Opening balance", 0.0)
        minimum = self._ask_optional_money("Minimum balance", 100.0)
        if opening is None or minimum is None:
            return
        account = self.bank.open_savings_account(customer_id, opening, minimum)
        print(f"Opened savings account.\n{account.describe()}")

    def open_checking_account(self):
        customer_id = self._ask_text("Customer ID: ")
        if customer_id is None:
            return
        opening = self._ask_optional_money("Opening balance", 0.0)
        overdraft = self._ask_optional_money("Overdraft limit", 500.0)
        if opening is None or overdraft is None:
            return
        account = self.bank.open_checking_account(customer_id, opening, overdraft)
        print(f"Opened checking account.\n{account.describe()}")

    def deposit_funds(self):
        number = self._ask_text("Account number: ")
        amount = self._ask_money("Amount to deposit: ")
        if number is None or amount is None:
            return
        transaction = self.bank.deposit(number, amount)
        account = self.bank.get_account(number)
        print(f"Deposit successful ({transaction.transaction_id}).")
        print(f"New balance: {account.get_balance()}")

    def withdraw_funds(self):
        number = self._ask_text("Account number: ")
        amount = self._ask_money("Amount to withdraw: ")
        if number is None or amount is None:
            return
        transaction = self.bank.withdraw(number, amount)
        account = self.bank.get_account(number)
        print(f"Withdrawal successful ({transaction.transaction_id}).")
        print(f"New balance: {account.get_balance()}")

    def transfer_funds(self):
        source = self._ask_text("From account number: ")
        destination = self._ask_text("To account number: ")
        amount = self._ask_money("Amount to transfer: ")
        if source is None or destination is None or amount is None:
            return
        transaction = self.bank.transfer(source, destination, amount)
        print(f"Transfer successful ({transaction.transaction_id}).")
        print(f"  {source} balance: {self.bank.get_account(source).get_balance()}")
        print(
            f"  {destination} balance: "
            f"{self.bank.get_account(destination).get_balance()}"
        )

    def show_account(self):
        number = self._ask_text("Account number: ")
        if number is None:
            return
        account = self.bank.get_account(number)
        print(account.describe())
        history = account.get_transactions()
        if not history:
            print("No transactions yet.")
            return
        print("Transaction history:")
        for transaction in history:
            print(f"  {transaction}")

    def list_branch_accounts(self):
        code = self._ask_text("Branch code: ")
        if code is None:
            return
        accounts = self.bank.accounts_for_branch(code)
        if not accounts:
            print(f"Branch {code} has no accounts yet.")
            return
        print(f"Accounts for branch {code}:")
        for account in accounts:
            print(f"  {account.describe()}")

    def monthly_volume_report(self):
        code = self._ask_text("Branch code: ")
        now = datetime.now()
        year = self._ask_int(f"Year (e.g. {now.year}): ")
        month = self._ask_int("Month (1-12): ")
        if code is None or year is None or month is None:
            return
        total = self.bank.monthly_transaction_volume(code, year, month)
        print(f"Transaction volume for branch {code} in {month:02d}/{year}: {total}")
        if total == 0.0:
            print("(No transactions were recorded for that branch in that month.)")

    def ratio_report(self):
        limit = self._ask_float("Staff-to-manager ratio limit: ")
        if limit is None:
            return
        branches = self.bank.branches_above_ratio(limit)
        if not branches:
            print(f"No branch has a staff-to-manager ratio above {limit}.")
            return
        print(f"Branches with a staff-to-manager ratio above {limit}:")
        for branch in branches:
            print(f"  {branch.describe()}")

    def exit_app(self):
        self._running = False
        print("Goodbye.")

    # ------------------------------------------------------------------
    # Demonstration data
    # ------------------------------------------------------------------
    def load_demo_data(self):
        """Fill the bank with a small, presentable data set."""
        if self.bank.get_branches():
            print("Demonstration data has already been loaded.")
            return
        seed_demo_data(self.bank)
        print("Demonstration data loaded:")
        for branch in self.bank.get_branches():
            print(f"  {branch.describe()}")
        for account in self.bank.get_accounts():
            print(f"  {account.describe()}")


def seed_demo_data(bank):
    """Create two branches, three customers, four accounts, and some activity."""
    # Positional instantiation.
    downtown = bank.add_branch(Branch("BR001", "Downtown", "MGR-01"))
    # Keyword instantiation of the very same class.
    harbour = bank.add_branch(
        Branch(branch_code="BR002", location="Harbour", manager_id="MGR-02")
    )
    for staff_id in ("STF-01", "STF-02", "STF-03"):
        downtown.add_staff(staff_id)
    harbour.add_staff("STF-04")

    bank.add_customer(Customer("CUST-01", "Aisha Khan", "aisha@example.com", "BR001"))
    bank.add_customer(Customer("CUST-02", "Ben Owusu", "ben@example.com", "BR001"))
    bank.add_customer(
        Customer(
            customer_id="CUST-03",
            name="Chen Wei",
            email="chen@example.com",
            branch_id="BR002",
        )
    )

    savings = bank.open_savings_account("CUST-01", 1000.00)
    checking = bank.open_checking_account("CUST-02", 250.00)
    harbour_savings = bank.open_savings_account(
        "CUST-03", opening_balance=800.00, minimum_balance=50.00
    )
    bank.open_checking_account("CUST-03", 0.00, 200.00)

    bank.deposit(savings.account_number, 250.00)
    bank.withdraw(checking.account_number, 100.00)
    bank.transfer(savings.account_number, checking.account_number, 150.00)
    # A cross-branch transfer, which counts once for each branch in the report.
    bank.transfer(harbour_savings.account_number, savings.account_number, 75.00)
    return bank


def main():
    app = BankingApplication()
    try:
        app.run()
    except KeyboardInterrupt:
        print("\nInterrupted. Goodbye.")


if __name__ == "__main__":
    main()
