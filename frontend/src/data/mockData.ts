/**
 * Hardcoded stand-in data for both dashboards.
 *
 * This is the ONLY file that should need to change when real auth/API
 * calls replace the mocks -- see src/services/customer.tsx and
 * src/services/employee.tsx, which are the seam between this data and the
 * pages/components that render it.
 */

// CustomerDashboardData and EmployeeDashboardData are declared globally in
// src/types/index.d.ts -- no import needed.

export const mockCustomerDashboard: CustomerDashboardData = {
  profile: {
    customerId: 'CUST-01',
    name: 'Aisha Khan',
    email: 'aisha@example.com',
    branchId: 'BR001',
    isActive: true,
  },
  accounts: [
    {
      accountNumber: 'AC1001',
      accountType: 'savings',
      balance: 5230.75,
      isActive: true,
      minimumBalance: 100,
    },
    {
      accountNumber: 'AC1002',
      accountType: 'checking',
      balance: 812.4,
      isActive: true,
      overdraftLimit: 500,
    },
  ],
  recentTransactions: [
    {
      transactionId: 'TX-9001',
      type: 'Deposit',
      amount: 250,
      fromAccountId: null,
      toAccountId: 'AC1001',
      description: 'Paycheck',
      timestamp: '2026-08-10T14:32:00Z',
    },
    {
      transactionId: 'TX-9000',
      type: 'Transfer',
      amount: 100,
      fromAccountId: 'AC1001',
      toAccountId: 'AC1002',
      description: 'Move to checking',
      timestamp: '2026-08-09T09:15:00Z',
    },
    {
      transactionId: 'TX-8999',
      type: 'Withdrawal',
      amount: 60,
      fromAccountId: 'AC1002',
      toAccountId: null,
      description: 'ATM withdrawal',
      timestamp: '2026-08-07T18:02:00Z',
    },
  ],
}

export const mockEmployeeDashboard: EmployeeDashboardData = {
  profile: {
    userId: 'USR-01',
    name: 'Marcus Diaz',
    email: 'teller1@bank.local',
    role: 'teller',
    branchId: 'BR001',
  },
  branchStats: {
    branchId: 'BR001',
    branchName: 'Downtown Branch',
    totalCustomers: 128,
    totalAccounts: 214,
    totalDeposits: 1_842_300.55,
    todaysTransactionVolume: 42_150.0,
  },
  recentTransactions: [
    {
      transactionId: 'TX-9001',
      type: 'Deposit',
      amount: 250,
      fromAccountId: null,
      toAccountId: 'AC1001',
      description: 'Paycheck',
      timestamp: '2026-08-10T14:32:00Z',
    },
    {
      transactionId: 'TX-8998',
      type: 'Transfer',
      amount: 400,
      fromAccountId: 'AC1005',
      toAccountId: 'AC1009',
      description: 'Rent',
      timestamp: '2026-08-10T11:47:00Z',
    },
    {
      transactionId: 'TX-8991',
      type: 'Withdrawal',
      amount: 120,
      fromAccountId: 'AC1012',
      toAccountId: null,
      description: 'Teller withdrawal',
      timestamp: '2026-08-10T10:03:00Z',
    },
    {
      transactionId: 'TX-8985',
      type: 'Deposit',
      amount: 1500,
      fromAccountId: null,
      toAccountId: 'AC1002',
      description: 'Check deposit',
      timestamp: '2026-08-09T16:20:00Z',
    },
  ],
  customers: [
    { customerId: 'CUST-01', name: 'Aisha Khan', email: 'aisha@example.com', branchId: 'BR001', isActive: true },
    { customerId: 'CUST-02', name: 'Ben Owusu', email: 'ben@example.com', branchId: 'BR001', isActive: true },
    { customerId: 'CUST-03', name: 'Chen Wei', email: 'chen@example.com', branchId: 'BR002', isActive: false },
  ],
}
