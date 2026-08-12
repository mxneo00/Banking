/**
 * Types related to budgets.
 * 
 * linked to accounts or transactions
 */

export type BudgetPeriod = 'weekly' | 'monthly'
 
export type Budget = {
  id: string
  customer_id: string
  category: string
  amount: number
  period: BudgetPeriod
  created_at: string
}
 
export type BudgetCreatePayload = {
  category: string
  amount: number
  period: BudgetPeriod
}
 
export type BudgetUpdatePayload = {
  category?: string
  amount?: number
  period?: BudgetPeriod
}