import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

// Admin pages
import Dashboard      from '../../pages/admin/Dashboard'
import Workers        from '../../pages/admin/Workers'
import Shifts         from '../../pages/admin/Shifts'
import Alerts         from '../../pages/admin/Alerts'
import Documents      from '../../pages/admin/Documents'
import Requests       from '../../pages/admin/Requests'
import Boletas        from '../../pages/admin/Boletas'
import Settings       from '../../pages/admin/Settings'
import InviteUser     from '../../pages/admin/InviteUser'
import GeoMonitor     from '../../pages/admin/GeoMonitor'
import AccountRequests from '../../pages/admin/AccountRequests'

// Worker pages
import WorkerHome     from '../../pages/worker/WorkerHome'
import WorkerCheckin  from '../../pages/worker/WorkerCheckin'
import WorkerShifts   from '../../pages/worker/WorkerShifts'
import WorkerRequests from '../../pages/worker/WorkerRequests'
import WorkerBoletas  from '../../pages/worker/WorkerBoletas'

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [badges, setBadges] = useState({ requests: 0, late: 0, accounts: 0 })

  const isAdmin  = profile?.role === 'admin'
  const initials = (profile?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    loadBadges()
    const iv = setInterval(loadBadges, 60000)
    const channel = supabase.channel('badges_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'account_requests' }, () => {
        setBadges(prev => ({ ...prev, accounts: prev.accounts + 1 }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'account_requests' }, loadBadges)
      .subscribe()
    return () => { clearInterval(iv); supabase.removeChannel(channel) }
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  async function loadBadges() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const [{ count: req }, { count: late }, { count: accounts }] = await Promise.all([
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('status', 'late').gte('checked_in_at', monthStart),
      supabase.from('account_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setBadges({ requests: req || 0, late: late || 0, accounts: accounts || 0 })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function go(path) { navigate(path); setSidebarOpen(false) }

  const ADMIN_NAV = [
    { section: 'Principal' },
    { id: '/',          label: 'Dashboard',       icon: '⊞',  path: '/' },
    { id: '/workers',   label: 'Personal',         icon: '👥', path: '/workers' },
    { id: '/shifts',    label: 'Turnos',           icon: '📅', path: '/shifts' },
    { id: '/geo',       label: 'Geolocalización',  icon: '📍', path: '/geo' },
    { section: 'Gestión' },
    { id: '/alerts',    label: 'Atrasos',          icon: '⚠',  path: '/alerts',   badge: badges.late,     badgeWarn: true },
    { id: '/requests',  label: 'Solicitudes',      icon: '📋', path: '/requests', badge: badges.requests },
    { id: '/documents', label: 'Documentos',       icon: '🗂',  path: '/documents' },
    { id: '/boletas',   label: 'Boletas',           icon: '💰', path: '/boletas' },
    { section: 'Sistema' },
    { id: '/accounts',  label: 'Solicitudes acceso', icon: '📬', path: '/accounts', badge: badges.accounts },
    { id: '/users',     label: 'Usuarios',          icon: '🔑', path: '/users' },
    { id: '/settings',  label: 'Configuración',     icon: '⚙',  path: '/settings' },
  ]

  const WORKER_NAV = [
    { section: 'Mi Panel' },
    { id: '/w',          label: 'Inicio',           icon: '🏠', path: '/w' },
    { id: '/w/checkin',  label: 'Asistencia',        icon: '📍', path: '/w/checkin' },
    { id: '/w/shifts',   label: 'Mis turnos',        icon: '📅', path: '/w/shifts' },
    { section: 'Gestión' },
    { id: '/w/requests', label: 'Solicitudes',       icon: '📋', path: '/w/requests' },
    { id: '/w/boletas',  label: 'Mis boletas',       icon: '💰', path: '/w/boletas' },
  ]

  // Bottom nav items for mobile (max 5)
  const ADMIN_BOTTOM = [
    { id: '/',         label: 'Inicio',     icon: '⊞',  path: '/' },
    { id: '/shifts',   label: 'Turnos',     icon: '📅', path: '/shifts' },
    { id: '/geo',      label: 'Geo',        icon: '📍', path: '/geo' },
    { id: '/requests', label: 'Solicitudes', icon: '📋', path: '/requests', badge: badges.requests },
    { id: '/accounts', label: 'Accesos',    icon: '📬', path: '/accounts', badge: badges.accounts },
  ]

  const WORKER_BOTTOM = [
    { id: '/w',          label: 'Inicio',    icon: '🏠', path: '/w' },
    { id: '/w/checkin',  label: 'Asistencia', icon: '📍', path: '/w/checkin' },
    { id: '/w/shifts',   label: 'Turnos',    icon: '📅', path: '/w/shifts' },
    { id: '/w/requests', label: 'Solicitudes', icon: '📋', path: '/w/requests' },
    { id: '/w/boletas',  label: 'Boletas',   icon: '💰', path: '/w/boletas' },
  ]

  const nav       = isAdmin ? ADMIN_NAV    : WORKER_NAV
  const bottomNav = isAdmin ? ADMIN_BOTTOM : WORKER_BOTTOM

  function isActive(path) {
    if (path === '/' || path === '/w') return location.pathname === path
    return location.pathname.startsWith(path)
  }

  // Current page label for mobile topbar
  const allNavItems = [...ADMIN_NAV, ...WORKER_NAV].filter(x => x.path)
  const currentPage = allNavItems.find(x => isActive(x.path))

  return (
    <div className="app">
      {/* ── MOBILE OVERLAY ── */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── SIDEBAR (desktop full, mobile slide-in) ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="brand" style={{ padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <img src="/logo.png" alt="SP" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,255,255,0.06)', padding: 3, flexShrink: 0 }} />
            <div>
              <div className="brand-title" style={{ fontSize: 12.5 }}>Speech Psychology</div>
              <div className="brand-sub">& CardioHome · Salud</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: isAdmin ? '#3b82f6' : '#22c55e', boxShadow: `0 0 6px ${isAdmin ? 'rgba(59,130,246,0.6)' : 'rgba(34,197,94,0.6)'}` }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
              {isAdmin ? 'Panel Administrador' : 'Panel Trabajador'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="nav">
          {nav.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section-label">{item.section}</div>
            ) : (
              <div
                key={item.id}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => go(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span className={`nav-badge ${item.badgeWarn ? 'warn' : ''}`}>{item.badge}</span>
                )}
              </div>
            )
          )}
        </nav>

        {/* User + sign out */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', marginBottom: 6 }}>
            <div className="user-avatar" style={{ background: isAdmin ? 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' : 'linear-gradient(135deg,#059669,#065f46)', color: '#fff' }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                {profile?.full_name || 'Usuario'}
              </div>
              <div className="user-role">{profile?.role_label || (isAdmin ? 'Administrador' : 'Profesional')}</div>
            </div>
            <div className="online-dot" />
          </div>
          <button
            onClick={handleSignOut}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8, color: 'rgba(252,165,165,0.85)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}
          >
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main">
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(v => !v)} aria-label="Menú">
            <span /><span /><span />
          </button>
          <div className="mobile-topbar-logo">
            <img src="/logo.png" alt="SP" />
            <span className="mobile-topbar-title">
              {currentPage?.label || 'HealthOps'}
            </span>
          </div>
          <div style={{ width: 38 }} /> {/* spacer */}
        </div>

        {/* Routes */}
        <Routes>
          {isAdmin ? (
            <>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/workers"   element={<Workers />} />
              <Route path="/shifts"    element={<Shifts />} />
              <Route path="/geo"       element={<GeoMonitor />} />
              <Route path="/alerts"    element={<Alerts />} />
              <Route path="/requests"  element={<Requests />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/boletas"   element={<Boletas />} />
              <Route path="/accounts"  element={<AccountRequests />} />
              <Route path="/users"     element={<InviteUser />} />
              <Route path="/settings"  element={<Settings />} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/w"          element={<WorkerHome />} />
              <Route path="/w/checkin"  element={<WorkerCheckin />} />
              <Route path="/w/shifts"   element={<WorkerShifts />} />
              <Route path="/w/requests" element={<WorkerRequests />} />
              <Route path="/w/boletas"  element={<WorkerBoletas />} />
              <Route path="*"           element={<Navigate to="/w" replace />} />
            </>
          )}
        </Routes>

        {/* Mobile bottom nav */}
        <nav className="mobile-nav">
          {bottomNav.map(item => (
            <div
              key={item.id}
              className={`mobile-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => go(item.path)}
            >
              {item.badge > 0 && (
                <span className="mobile-nav-badge">{item.badge}</span>
              )}
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </div>
          ))}
        </nav>
      </main>
    </div>
  )
}
