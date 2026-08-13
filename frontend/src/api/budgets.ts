/**
 * Budget API functions for interacting with the backend.
 */

import { apiClient } from './client'
import type { Budget, BudgetCreatePayload, BudgetUpdatePayload } from '../types/budget'
 
export async function fetchBudgets(): Promise<Budget[]> {
  const { data } = await apiClient.get<Budget[]>('/api/v1/budgets')
  return data
}
 
export async function createBudget(payload: BudgetCreatePayload): Promise<Budget> {
  const { data } = await apiClient.post<Budget>('/api/v1/budgets', payload)
  return data
}
 
export async function updateBudget(budgetId: string, payload: BudgetUpdatePayload): Promise<Budget> {
  const { data } = await apiClient.put<Budget>(`/api/v1/budgets/${budgetId}`, payload)
  return data
}
 
export async function deleteBudget(budgetId: string): Promise<void> {
  await apiClient.delete(`/api/v1/budgets/${budgetId}`)
}