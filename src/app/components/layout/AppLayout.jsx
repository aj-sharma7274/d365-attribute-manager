import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusSquare, Trash2, Download,
  ScrollText, LogOut, ChevronLeft, ChevronRight,
  Shield, Settings, Menu, X
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bulk-create', label: 'Bulk Create', icon: PlusSquare },
  { to: '/bulk-delete', label: 'Bulk Delete', icon: Trash2 },
  { to: '/export-schema', label: 'Export Schema', icon: Download },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { orgUrl, clearSession } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await clearSession()
    toast.success('Session cleared')
    navigate('/auth')
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div
        className={clsx(
          'flex items-center gap-3 py-5 px-4 border-b flex-shrink-0',
          collapsed && 'justify-center px-2'
        )}
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 16px var(--accent-glow)' }}
        >
          <Shield size={15} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-display font-bold text-sm"
              style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}>
              D365 PK
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              Open Source
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              collapsed && 'justify-center'
            )}
            style={({ isActive }) => ({
              background: isActive ? 'var(--nav-active-bg)' : 'transparent',
              border: isActive ? `1px solid var(--nav-active-border)` : '1px solid transparent',
              color: isActive ? 'var(--nav-active-text)' : 'var(--nav-inactive-text)',
            })}
          >
            <Icon size={16} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-2 flex-shrink-0"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {!collapsed && orgUrl && (
          <div
            className="px-3 py-2 rounded-xl"
            style={{ background: 'var(--glass1)', border: '1px solid var(--glass-border)' }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 2 }}>
              Connected
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-accent)', fontFamily: 'monospace' }}
              className="truncate">
              {orgUrl.replace('https://', '')}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={clsx(
            'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-all',
            collapsed && 'justify-center'
          )}
          style={{ color: 'var(--danger-text)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--danger-bg)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <LogOut size={14} />
          {!collapsed && 'Clear Session'}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--page-bg)' }}>

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'var(--page-grad1)', filter: 'blur(80px)', top: -100, left: -80 }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'var(--page-grad2)', filter: 'blur(80px)', top: 50, right: -60 }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'var(--page-grad3)', filter: 'blur(80px)', bottom: -60, left: '40%' }} />
      </div>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={clsx(
          'hidden md:flex flex-col flex-shrink-0 transition-all duration-300 relative z-20',
          collapsed ? 'w-16' : 'w-56'
        )}
        style={{
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Desktop collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="hidden md:flex fixed top-1/2 -translate-y-1/2 z-30 w-5 h-9 items-center justify-center rounded-r-lg transition-all"
        style={{
          left: collapsed ? '3.5rem' : '13.5rem',
          background: 'var(--glass2)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-muted)',
        }}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={clsx(
          'md:hidden fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 w-56',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto relative z-10 flex flex-col">

        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)', background: 'var(--sidebar-bg)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)' }}>
              <Shield size={12} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm"
              style={{ color: 'var(--text-primary)' }}>
              D365 AM
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 px-4 md:px-8 py-6 md:py-8 animate-fade-in">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}