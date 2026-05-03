import { useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// Admin pages
import Dashboard    from '../../pages/admin/Dashboard'
import Workers      from '../../pages/admin/Workers'
import Shifts       from '../../pages/admin/Shifts'
import Alerts       from '../../pages/admin/Alerts'
import Documents    from '../../pages/admin/Documents'
import Requests     from '../../pages/admin/Requests'
import Boletas      from '../../pages/admin/Boletas'
import Settings     from '../../pages/admin/Settings'
import InviteUser   from '../../pages/admin/InviteUser'

// Worker pages
import WorkerHome    from '../../pages/worker/WorkerHome'
import WorkerCheckin from '../../pages/worker/WorkerCheckin'
import WorkerShifts  from '../../pages/worker/WorkerShifts'
import WorkerRequests from '../../pages/worker/WorkerRequests'
import WorkerBoletas from '../../pages/worker/WorkerBoletas'

const ADMIN_NAV = [
  { section: 'Principal' },
  { id: '/',           label: 'Dashboard',     icon: '⊞',  path: '/' },
  { id: '/workers',    label: 'Personal',       icon: '👥', path: '/workers' },
  { id: '/shifts',     label: 'Turnos',         icon: '📅', path: '/shifts' },
  { section: 'Gestión' },
  { id: '/alerts',     label: 'Atrasos',        icon: '⚠',  path: '/alerts', badge: '7', badgeType: 'warn' },
  { id: '/requests',   label: 'Solicitudes',    icon: '📋', path: '/requests', badge: '3' },
  { id: '/documents',  label: 'Documentos',     icon: '🗂',  path: '/documents' },
  { id: '/boletas',    label: 'Boletas',         icon: '💰', path: '/boletas' },
  { section: 'Sistema' },
  { id: '/users',     label: 'Usuarios',        icon: '🔑', path: '/users' },
  { id: '/settings',  label: 'Configuración',   icon: '⚙',  path: '/settings' },
]

const WORKER_NAV = [
  { section: 'Mi Panel' },
  { id: '/w',          label: 'Inicio',         icon: '🏠', path: '/w' },
  { id: '/w/checkin',  label: 'Marcar asistencia', icon: '📍', path: '/w/checkin' },
  { id: '/w/shifts',   label: 'Mis turnos',     icon: '📅', path: '/w/shifts' },
  { section: 'Gestión' },
  { id: '/w/requests', label: 'Solicitudes',    icon: '📋', path: '/w/requests' },
  { id: '/w/boletas',  label: 'Mis boletas',    icon: '💰', path: '/w/boletas' },
]

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const [role, setRole]      = useState('admin') // default; real app reads profile.role
  const navigate  = useNavigate()
  const location  = useLocation()

  const nav = role === 'admin' ? ADMIN_NAV : WORKER_NAV
  const initials = profile ? (profile.full_name || 'AD').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'AD'

  function switchRole(r) {
    setRole(r)
    navigate(r === 'admin' ? '/' : '/w')
  }

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo-row">
            <div className="brand-icon">🏥</div>
            <div>
              <div className="brand-title">SP & CardioHome</div>
              <div className="brand-sub">Gestión de Servicios de Salud</div>
            </div>
          </div>
          <div className="role-switcher">
            <button className={`role-btn ${role === 'admin' ? 'active' : ''}`} onClick={() => switchRole('admin')}>Admin</button>
            <button className={`role-btn ${role === 'worker' ? 'active' : ''}`} onClick={() => switchRole('worker')}>Trabajador</button>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section-label">{item.section}</div>
            ) : (
              <div
                key={item.id}
                className={`nav-item ${location.pathname === item.path || (item.path !== '/' && item.path !== '/w' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span className={`nav-badge ${item.badgeType === 'warn' ? 'warn' : ''}`}>{item.badge}</span>
                )}
              </div>
            )
          )}
        </nav>

        <div className="sidebar-user" onClick={signOut} title="Cerrar sesión">
          <div className="user-avatar" style={{ background: role === 'admin' ? 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' : 'linear-gradient(135deg,#059669,#065f46)', color: '#fff' }}>
            {initials}
          </div>
          <div>
            <div className="user-name">{profile?.full_name || (role === 'admin' ? 'Administrador' : 'Trabajador')}</div>
            <div className="user-role">{profile?.role_label || (role === 'admin' ? 'Administrador' : 'Profesional de salud')}</div>
          </div>
          <div className="online-dot" />
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main">
        <Routes>
          {/* Admin routes */}
          <Route path="/"           element={<Dashboard />} />
          <Route path="/workers"    element={<Workers />} />
          <Route path="/shifts"     element={<Shifts />} />
          <Route path="/alerts"     element={<Alerts />} />
          <Route path="/requests"   element={<Requests />} />
          <Route path="/documents"  element={<Documents />} />
          <Route path="/boletas"    element={<Boletas />} />
          <Route path="/users"      element={<InviteUser />} />
          <Route path="/settings"   element={<Settings />} />
          {/* Worker routes */}
          <Route path="/w"          element={<WorkerHome />} />
          <Route path="/w/checkin"  element={<WorkerCheckin />} />
          <Route path="/w/shifts"   element={<WorkerShifts />} />
          <Route path="/w/requests" element={<WorkerRequests />} />
          <Route path="/w/boletas"  element={<WorkerBoletas />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
