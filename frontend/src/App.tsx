import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PropertyProvider } from './context/PropertyContext'
import Layout from './components/Layout'
import MarketingLayout from './components/MarketingLayout'
import Home from './pages/Home'
import Reviews from './pages/Reviews'
import Analytics from './pages/Analytics'
import AnalyticsReport from './pages/AnalyticsReport'
import Rates from './pages/Rates'
import Calendar from './pages/Calendar'
import Pricing from './pages/Pricing'
import Help from './pages/Help'
import Resources from './pages/Resources'
import About from './pages/About'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import ConnectProperty from './pages/ConnectProperty'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="loading" style={{ marginTop: 120 }}>Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <div className="loading" style={{ marginTop: 120 }}>Loading…</div>

  return (
    <Routes>
      {/* Login — standalone, no layout. Logged-in users land on the onboarding dashboard. */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Public marketing pages — visible to anyone, no sidebar. */}
      <Route path="/" element={<MarketingLayout><Home /></MarketingLayout>} />
      <Route path="/pricing" element={<MarketingLayout><Pricing /></MarketingLayout>} />
      <Route path="/about" element={<MarketingLayout><About /></MarketingLayout>} />
      <Route path="/resources" element={<MarketingLayout><Resources /></MarketingLayout>} />
      <Route path="/help" element={<MarketingLayout><Help /></MarketingLayout>} />
      <Route path="/contact" element={<MarketingLayout><Contact /></MarketingLayout>} />

      {/* Protected app routes — require login, render with the sidebar Layout. */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>}
      />
      <Route
        path="/reviews"
        element={<ProtectedRoute><Layout><Reviews /></Layout></ProtectedRoute>}
      />
      <Route
        path="/rates"
        element={<ProtectedRoute><Layout><Rates /></Layout></ProtectedRoute>}
      />
      <Route
        path="/calendar"
        element={<ProtectedRoute><Layout><Calendar /></Layout></ProtectedRoute>}
      />
      <Route
        path="/analytics"
        element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>}
      />
      <Route
        path="/analytics/report"
        element={<ProtectedRoute><AnalyticsReport /></ProtectedRoute>}
      />
      <Route
        path="/connect-property"
        element={<ProtectedRoute><Layout><ConnectProperty /></Layout></ProtectedRoute>}
      />
      <Route
        path="/profile"
        element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>}
      />
      <Route
        path="/settings"
        element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>}
      />

      {/* Anything else → home. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <PropertyProvider>
        <AppRoutes />
      </PropertyProvider>
    </AuthProvider>
  )
}

export default App
