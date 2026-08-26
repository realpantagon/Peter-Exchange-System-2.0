import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RateDisplay from './components/RateDisplay'
import AdminPage from './components/AdminPage'
import SystemPage from './components/SystemPage'
import SuperAdminPage from './components/SuperAdminPage'
import AdminLayout from './components/AdminLayout'

import RootPage from './components/RootPage'
import DailyDetailPage from './components/DailyDetailPage'
import RateHistoryPage from './components/RateHistoryPage'
import SalesForecastPage from './components/SalesForecastPage'

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Admin/root pages share one sidebar (AdminLayout) so navigating
            between them is fast and returns to where you left off. */}
        <Route element={<AdminLayout />}>
          <Route path="/admin2025" element={<AdminPage />} />
          <Route path="/rate-history" element={<RateHistoryPage />} />
          <Route path="/sales-forecast" element={<SalesForecastPage />} />
          <Route path="/superadmin2025" element={<SuperAdminPage />} />
          <Route path="/root" element={<RootPage />} />
          <Route path="/root/daily" element={<DailyDetailPage />} />
        </Route>

        {/*
          RULE: /system2025 (the POS staff use to record sales) and "/"
          (the public rate board — staff control what it shows) must stay
          OUTSIDE AdminLayout and must never link into it: no sidebar on
          either page, no nav link to "/" from the sidebar, no nav links to
          admin routes inside SystemPage. Staff running the sales/rate-board
          side must not be able to browse into admin pages (root ledger,
          rate settings, super admin) from there. Keep these as standalone
          routes.
        */}
        <Route path="/" element={<RateDisplay />} />
        <Route path="/system2025" element={<SystemPage />} />
      </Routes>
    </Router>
  )
}
