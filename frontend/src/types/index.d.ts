/**
 * Shared frontend types describing the shapes the backend already returns
 * (see app/models/database.py's to_dict()/serialize helpers and
 * app/services/transactionService.py's _serialize on the Python side).
 *
 * Keeping these in one place means the mock data (src/data/mockData.ts) and
 * the real API responses (once wired up) can be typed identically -- when
 * auth/fetching replaces the mocks, these types don't need to change, only
 * where the data comes from does.
 *
 * NOTE: no TypeScript `enum` here on purpose -- this project's tsconfig has
 * `erasableSyntaxOnly: true`, which disallows enums (they compile to real
 * runtime code, not just erased types). Plain string-literal union types
 * give the same autocomplete/safety and are fully erasable.
 */

declare type UserRole = 'customer' | 'teller' | 'branch_manager' | 'admin'

declare type AccountType = 'savings' | 'checking'

declare type TransactionType = 'Deposit' | 'Withdrawal' | 'Transfer'

declare interface Account {
  accountNumber: string
  accountType: AccountType
  balance: number
  isActive: boolean
  /** Savings accounts only. */
  minimumBalance?: number
  /** Checking accounts only. */
  overdraftLimit?: number
}

declare interface Transaction {
  transactionId: string
  type: TransactionType
  amount: number
  fromAccountId: string | null
  toAccountId: string | null
  description?: string
  /** ISO 8601 timestamp string. */
  timestamp: string
}

declare interface CustomerProfile {
  customerId: string
  name: string
  email: string
  branchId: string
  isActive: boolean
}

declare interface EmployeeProfile {
  userId: string
  name: string
  email: string
  role: UserRole
  branchId: string
}

declare interface BranchStats {
  branchId: string
  branchName: string
  totalCustomers: number
  totalAccounts: number
  totalDeposits: number
  todaysTransactionVolume: number
}

/** Everything the customer-facing dashboard needs, in one payload. */
declare interface CustomerDashboardData {
  profile: CustomerProfile
  accounts: Account[]
  recentTransactions: Transaction[]
}

/** Everything the staff-facing (teller/branch_manager/admin) dashboard needs. */
declare interface EmployeeDashboardData {
  profile: EmployeeProfile
  branchStats: BranchStats
  recentTransactions: Transaction[]
  customers: CustomerProfile[]
}
