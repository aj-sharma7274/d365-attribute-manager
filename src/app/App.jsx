import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './pages/Auth'
import Dashboard from './pages/Dashboard'
import DebugPage from './pages/Debug'
import SettingsPage from './pages/Settings'

// Placeholder pages — built in upcoming phases
import BulkCreatePage from './pages/BulkCreate'
import BulkDeletePage from './pages/BulkDelete'
const ExportSchema = () => <PlaceholderPage title="Export Schema" />
const Logs = () => <PlaceholderPage title="Operation Logs" />

function PlaceholderPage({ title }) {
  return (
    <div className="card text-center py-16">
      <p className="text-2xl mb-2">🚧</p>
      <h2 className="font-display font-bold text-xl mb-2"
        style={{ color: 'var(--text-primary)' }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Coming soon
      </p>
    </div>
  )
}

function RequireAuth({ children }) {
  const { authenticated, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Verifying session...
        </p>
      </div>
    </div>
  )
  return authenticated ? children : <Navigate to="/auth" replace />
}

export default function App() {
  const { checkAuth } = useAuthStore()
  const { initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
    checkAuth()
  }, [])

  // Disable right-click context menu
  useEffect(() => {
    const handler = (e) => e.preventDefault()
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }, [])

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="bulk-create" element={<BulkCreatePage />} />
<Route path="bulk-delete" element={<BulkDeletePage />} />
        <Route path="export-schema" element={<ExportSchema />} />
        <Route path="logs" element={<Logs />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="debug" element={<DebugPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}