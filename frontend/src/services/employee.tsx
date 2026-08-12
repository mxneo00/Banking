/**
 * "Employee" here maps to a User with a staff role (teller, branch_manager,
 * admin) -- there's no separate Employee resource on the backend, just
 * models/database.py's UserORM with role != "customer". Staff onboarding
 * goes through POST /api/v1/auth/staff (admin-only, see services/auth.tsx's
 * createStaff), and day-to-day staff tools reuse the same customer/account/
 * transaction endpoints everything else does, just unlocked by role (see
 * security/dependencies.py's require_roles on the backend).
 *
 * This file re-exports the pieces specifically relevant to a staff
 * workflow so callers don't need to know that mapping themselves.
 */

export { createStaff, getMe, login, logout } from './auth'
export { createCustomer, deactivateCustomer, listCustomers } from './customer'
export { createTransaction, listTransactions } from './transaction'
