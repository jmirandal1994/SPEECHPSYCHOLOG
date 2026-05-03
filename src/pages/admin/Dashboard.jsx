import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [stats, setStats]     = useState({ workers: 0, shifts: 0, late: 0, fees: 0 })
  const [activity, setActivity] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [
      { count: workerCount },
      { count: shiftCount },
      { count: lateCount },
      { data: activityData },
      { data: requestData },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'worker'),
      supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('status', 'late'),
      supabase.from('attendances').select('*, profiles(full_name, role_label, project)').order('checked_in_at', { ascending: false }).limit(6),
      supabase.from('requests').select('*, profiles(full_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
    ])

    setStats({
      workers: workerCount || 0,
      shifts:  shiftCount  || 0,
      late:    lateCount   || 0,
      fees:    0, // computed from boletas
    })
    setActivity(activityData || [])
    setRequests(requestData  || [])
    setLoading(false)
  }

  async function handleRequest(id, action) {
    await supabase.from('requests').update({ status: action === 'approve' ? 'approved' : 'rejected' }).eq('id', id)
    setRequests(r => r.filter(x => x.id !== id))
  }

  const STAT_CARDS = [
    { label: 'Personal activo', value: stats.workers, accent: 'accent-blue',  icon: '👥', delta: 'Profesionales registrados', icon_bg: 'var(--navy-200)', icon_color: 'var(--navy-700)' },
    { label: 'Turnos completados', value: stats.shifts, accent: 'accent-green', icon: '✔', delta: 'Mes en curso', icon_bg: 'var(--emerald-l)', icon_color: 'var(--emerald-d)' },
    { label: 'Atrasos en el mes', value: stats.late, accent: 'accent-amber', icon: '⏰', delta: stats.late > 5 ? '⚠ Supera umbral' : 'Dentro de límite', icon_bg: 'var(--amber-l)', icon_color: 'var(--amber)', deltaClass: stats.late > 5 ? 'warn' : '' },
    { label: 'Honorarios estimados', value: '$4.2M', accent: 'accent-teal', icon: '💰', delta: 'CLP · mes actual', icon_bg: 'var(--teal-l)', icon_color: 'var(--teal)' },
  ]

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-sub">Resumen operacional · Mayo 2025</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm">📊 Exportar reporte</button>
          <button className="btn btn-primary btn-sm">+ Nuevo turno</button>
        </div>
      </div>

      <div className="content">
        {/* Critical alert */}
        <div className="alert alert-crit">
          <span className="alert-icon">🚨</span>
          <div className="alert-body">
            <div className="alert-title">Alerta de atrasos críticos — 2 profesionales superan el límite mensual</div>
            <div className="alert-msg">Ana Pinto y Roberto Salinas acumulan más de 2 atrasos en mayo 2025. El sistema ha marcado sus perfiles para revisión administrativa.</div>
            <div className="alert-actions">
              <button className="btn btn-danger btn-xs" onClick={() => window.location='/alerts'}>Ver detalle completo</button>
              <button className="btn btn-xs">Descartar aviso</button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {STAT_CARDS.map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.icon_bg, color: s.icon_color }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className={`stat-delta ${s.deltaClass || ''}`}>{s.delta}</div>
            </div>
          ))}
        </div>

        <div className="g13">
          {/* Team activity */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Actividad del equipo hoy</div>
                <div className="card-sub">Profesionales en turno activo</div>
              </div>
              <span className="badge badge-live">● En vivo</span>
            </div>

            {loading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : activity.length === 0 ? (
              /* Fallback with mock data while DB is empty */
              <>
                {[
                  { name: 'María González', role: 'Enfermera · CardioHome Sur', time: '08:32 ✓', status: 'ok', initials: 'MG', bg: '#dbeafe', col: '#1e3a8a' },
                  { name: 'Carlos Ramírez', role: 'TENS · Speech Norte', time: '08:45 ✓', status: 'ok', initials: 'CR', bg: '#d1fae5', col: '#065f46' },
                  { name: 'Lucía Pérez', role: 'Auxiliar · CardioHome Norte', time: '09:01 ✓', status: 'ok', initials: 'LP', bg: '#fef9c3', col: '#92400e' },
                  { name: 'Ana Pinto ⚠', role: '3er atraso del mes · +35 min · Alerta crítica', time: 'Tarde', status: 'late', initials: 'AP', bg: '#fee2e2', col: '#991b1b' },
                  { name: 'José Vargas', role: 'TENS · CardioHome Sur', time: 'Turno tarde', status: 'off', initials: 'JV', bg: '#f1f5f9', col: '#64748b' },
                  { name: 'Roberto Salinas', role: 'TENS · CardioHome Sur', time: '07:58 ✓', status: 'ok', initials: 'RS', bg: '#d1fae5', col: '#065f46' },
                ].map((w, i) => (
                  <div className="worker-row" key={i} style={w.status === 'late' ? { background: '#fff5f5', borderRadius: 9, padding: '10px 12px', border: '1px solid #fca5a5', margin: '4px -12px' } : {}}>
                    <div className="worker-avatar" style={{ background: w.bg, color: w.col }}>{w.initials}</div>
                    <div className="worker-info">
                      <div className="worker-name" style={w.status === 'late' ? { color: 'var(--red)' } : {}}>{w.name}</div>
                      <div className="worker-role" style={w.status === 'late' ? { color: '#c2410c', fontWeight: 600 } : {}}>{w.role}</div>
                    </div>
                    <div className={`status-dot ${w.status === 'ok' ? 'dot-green' : w.status === 'late' ? 'dot-amber' : 'dot-gray'}`} />
                    <span className={`badge ${w.status === 'ok' ? 'badge-green' : w.status === 'late' ? 'badge-red' : 'badge-gray'}`}>{w.time}</span>
                  </div>
                ))}
              </>
            ) : (
              activity.map(a => (
                <div className="worker-row" key={a.id}>
                  <div className="worker-avatar" style={{ background: '#dbeafe', color: '#1e3a8a' }}>
                    {(a.profiles?.full_name || 'XX').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="worker-info">
                    <div className="worker-name">{a.profiles?.full_name}</div>
                    <div className="worker-role">{a.profiles?.role_label} · {a.profiles?.project}</div>
                  </div>
                  <div className={`status-dot ${a.status === 'late' ? 'dot-amber' : 'dot-green'}`} />
                  <span className={`badge ${a.status === 'late' ? 'badge-amber' : 'badge-green'}`}>
                    {a.status === 'late' ? 'Con atraso' : 'A tiempo ✓'}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Pending requests */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div className="card-title">Solicitudes pendientes</div>
                <span className="badge badge-red">{requests.length || 3} pendientes</span>
              </div>
              {(requests.length ? requests : [
                { id: 1, type: 'inasistencia', profiles: { full_name: 'M. González' }, description: 'Mañana · CardioHome Sur', icon: '📋', bg: 'var(--amber-l)' },
                { id: 2, type: 'reclamo', profiles: { full_name: 'C. Ramírez' }, description: 'Turno 12 mayo', icon: '⚠', bg: 'var(--red-l)' },
                { id: 3, type: 'cambio', profiles: { full_name: 'L. Pérez' }, description: '18 mayo', icon: '🔄', bg: 'var(--navy-200)' },
              ]).map(r => (
                <div className="notif-row" key={r.id}>
                  <div className="notif-icon" style={{ background: r.bg || 'var(--amber-l)' }}>{r.icon || '📋'}</div>
                  <div style={{ flex: 1 }}>
                    <div className="notif-title">{r.type?.charAt(0).toUpperCase() + r.type?.slice(1)} · {r.profiles?.full_name}</div>
                    <div className="notif-sub">{r.description || r.created_at?.slice(0,10)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-success btn-xs" onClick={() => handleRequest(r.id, 'approve')}>✓</button>
                    <button className="btn btn-danger btn-xs" onClick={() => handleRequest(r.id, 'reject')}>✗</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Project occupancy */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Ocupación proyectos</div>
              {[
                { name: 'CardioHome Sur', value: 8, max: 10, cls: 'pf-green', col: 'var(--emerald)' },
                { name: 'Speech Norte',   value: 5, max: 8,  cls: 'pf-blue',  col: 'var(--navy-500)' },
                { name: 'Speech Centro',  value: 6, max: 6,  cls: 'pf-amber', col: 'var(--amber)' },
              ].map(p => (
                <div key={p.name} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{p.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.col }}>{p.value}/{p.max}</span>
                  </div>
                  <div className="progress">
                    <div className={`progress-fill ${p.cls}`} style={{ width: `${(p.value/p.max)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
