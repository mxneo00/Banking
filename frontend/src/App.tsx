import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import GuestRoute from './components/GuestRoute'
import ProtectedRoute from './components/ProtectedRoute'
import CustomerRoute from './components/CustomerRoute'
import StaffRoute from './components/StaffRoute'
import RoleHomeRedirect from './components/RoleHomeRedirect'
import DashboardPage from './pages/DashboardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import StaffDashboardPage from './pages/StaffDashboardPage'
import StaffTransactionsPage from './pages/StaffTransactionsPage'
import CashDeskPage from './pages/CashDeskPage'
import AccountPage from './pages/AccountPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import BudgetPage from './pages/BudgetPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Customer portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<CustomerRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="accounts" element={<AccountPage />} />
              <Route path="budgets" element={<BudgetPage />} />
            </Route>
          </Route>
        </Route>

        {/* Staff portal */}
        <Route element={<StaffRoute />}>
          <Route element={<AppLayout />}>
            <Route path="staff" element={<StaffDashboardPage />} />
            <Route path="cash-desk" element={<CashDeskPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="transactions" element={<StaffTransactionsPage />} />
          </Route>
        </Route>

        <Route path="/staff/login" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
