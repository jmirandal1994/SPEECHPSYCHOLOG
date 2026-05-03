import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]           = useState({ workers: 0, shifts: 0, late: 0, fees: 0 })
  const [activity, setActivity]     = useState([])
  const [requests, setRequests]     = useState([])
  const [criticalAlerts, setCritical] = useState([])
  const [loading, setLoading]       = useState(true)

  const now        = new Date()
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [
      { count: workerCount },
      { count: shiftCount },
      { count: lateCount },
      { data: activityData },
      { data: requestData },
      { data: boletaData },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'worker').eq('status', 'active'),
      supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('shift_date', monthStart),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('status', 'late').gte('checked_in_at', monthStart),
      supabase.from('attendances').select('*, profiles(full_name, role_label, project)').order('checked_in_at', { ascending: false }).limit(8),
      supabase.from('requests').select('*, profiles(full_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('boletas').select('amount').eq('status', 'submitted'),
    ])

    const totalFees = (boletaData || []).reduce((s, b) => s + (b.amount || 0), 0)
    setStats({ workers: workerCount || 0, shifts: shiftCount || 0, late: lateCount || 0, fees: totalFees })
    setActivity(activityData || [])
    setRequests(requestData  || [])

    // Real critical alerts: workers with 2+ lates this month
    if ((lateCount || 0) > 0) {
      const { data: lateWorkers } = await supabase
        .from('attendances')
        .select('worker_id, profiles(full_name)')
        .eq('status', 'late')
        .gte('checked_in_at', monthStart)
      const counts = {}
      ;(lateWorkers || []).forEach(a => {
        if (!counts[a.worker_id]) counts[a.worker_id] = { name: a.profiles?.full_name, count: 0 }
        counts[a.worker_id].count++
      })
      setCritical(Object.values(counts).filter(w => w.count >= 2))
    } else {
      setCritical([])
    }
    setLoading(false)
  }

  async function handleRequest(id, action) {
    await supabase.from('requests').update({ status: action === 'approve' ? 'approved' : 'rejected' }).eq('id', id)
    setRequests(r => r.filter(x => x.id !== id))
  }

  const COLORS = [
    { bg: '#dbeafe', col: '#1e3a8a' }, { bg: '#d1fae5', col: '#065f46' },
    { bg: '#fef9c3', col: '#92400e' }, { bg: '#fce7f3', col: '#9d174d' },
    { bg: '#ede9fe', col: '#4c1d95' }, { bg: '#cffafe', col: '#0e7490' },
  ]
  const initials = name => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const fmtFee   = n => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n > 0 ? `$${(n/1000).toFixed(0)}K` : '$0'
  const TYPE_ICON  = { inasistencia: '📋', reclamo: '⚠', cambio: '🔄' }
  const TYPE_LABEL = { inasistencia: 'Inasistencia', reclamo: 'Reclamo', cambio: 'Cambio turno' }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-sub">Resumen operacional · {monthLabel}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/shifts')}>+ Nuevo turno</button>
        </div>
      </div>

      <div className="content">
        {/* Alerta crítica — solo aparece con datos reales */}
        {criticalAlerts.length > 0 && (
          <div className="alert alert-crit">
            <span className="alert-icon">🚨</span>
            <div className="alert-body">
              <div className="alert-title">
                {criticalAlerts.length} profesional{criticalAlerts.length > 1 ? 'es superan' : ' supera'} el límite de atrasos mensuales
              </div>
              <div className="alert-msg">
                {criticalAlerts.map(w => w.name).join(', ')} — {monthLabel}
              </div>
              <div className="alert-actions">
                <button className="btn btn-danger btn-xs" onClick={() => navigate('/alerts')}>Ver detalle</button>
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="stats-grid">
          {[
            { label: 'Personal activo',        value: loading ? '—' : stats.workers, accent: 'accent-blue',  icon: '👥', ibg: 'var(--navy-200)',   icl: 'var(--navy-700)',   delta: stats.workers === 0 ? 'Agrega profesionales en Personal' : 'Profesionales activos' },
            { label: 'Turnos completados',      value: loading ? '—' : stats.shifts,  accent: 'accent-green', icon: '✔',  ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)', delta: monthLabel },
            { label: 'Atrasos en el mes',       value: loading ? '—' : stats.late,   accent: stats.late > 0 ? 'accent-amber' : 'accent-green', icon: '⏰', ibg: stats.late > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: stats.late > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: stats.late === 0 ? '✓ Sin atrasos' : `${stats.late} incidencia${stats.late > 1 ? 's' : ''}`, deltaClass: stats.late > 0 ? 'warn' : '' },
            { label: 'Honorarios pendientes',   value: loading ? '—' : fmtFee(stats.fees), accent: 'accent-teal', icon: '💰', ibg: 'var(--teal-l)', icl: 'var(--teal)', delta: stats.fees === 0 ? 'Sin boletas pendientes' : 'CLP · boletas recibidas' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.ibg, color: s.icl }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: String(s.value).length > 4 ? 22 : undefined }}>{s.value}</div>
              <div className={`stat-delta ${s.deltaClass || ''}`}>{s.delta}</div>
            </div>
          ))}
        </div>

        <div className="g13">
          {/* Actividad */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Actividad del equipo hoy</div>
                <div className="card-sub">Registros de asistencia recientes</div>
              </div>
              <span className="badge badge-live">● En vivo</span>
            </div>
            {loading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : activity.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">Sin actividad registrada aún</div>
                <div className="empty-state-sub">Los registros de asistencia aparecerán aquí cuando los profesionales marquen entrada</div>
                <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => navigate('/workers')}>
                  Gestionar personal →
                </button>
              </div>
            ) : activity.map((a, i) => {
              const c = COLORS[i % COLORS.length]
              return (
                <div className="worker-row" key={a.id}
                  style={a.status === 'late' ? { background: '#fff5f5', borderRadius: 9, padding: '10px 12px', border: '1px solid #fca5a5', margin: '4px -12px' } : {}}
                >
                  <div className="worker-avatar" style={{ background: c.bg, color: c.col }}>
                    {initials(a.profiles?.full_name)}
                  </div>
                  <div className="worker-info">
                    <div className="worker-name" style={a.status === 'late' ? { color: 'var(--red)' } : {}}>
                      {a.profiles?.full_name || 'Sin nombre'}
                    </div>
                    <div className="worker-role">
                      {[a.profiles?.role_label, a.profiles?.project].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className={`status-dot ${a.status === 'late' ? 'dot-amber' : 'dot-green'}`} />
                  <span className={`badge ${a.status === 'late' ? 'badge-red' : 'badge-green'}`}>
                    {a.status === 'late' ? '⚠ Con atraso' : 'A tiempo ✓'}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Solicitudes */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div className="card-title">Solicitudes pendientes</div>
                {requests.length > 0 && (
                  <span className="badge badge-red">{requests.length} pendiente{requests.length > 1 ? 's' : ''}</span>
                )}
              </div>
              {loading ? (
                <div className="empty-state" style={{ padding: '16px 0' }}><div className="spinner" /></div>
              ) : requests.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title">Sin solicitudes pendientes</div>
                  <div className="empty-state-sub">Todo al día</div>
                </div>
              ) : requests.map(r => (
                <div className="notif-row" key={r.id}>
                  <div className="notif-icon" style={{ background: r.type === 'reclamo' ? 'var(--red-l)' : r.type === 'cambio' ? 'var(--navy-200)' : 'var(--amber-l)' }}>
                    {TYPE_ICON[r.type] || '📋'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="notif-title">{TYPE_LABEL[r.type] || r.type} · {r.profiles?.full_name}</div>
                    <div className="notif-sub">{r.created_at?.slice(0, 10)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-success btn-xs" onClick={() => handleRequest(r.id, 'approve')}>✓</button>
                    <button className="btn btn-danger btn-xs" onClick={() => handleRequest(r.id, 'reject')}>✗</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones rápidas */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 14 }}>Acciones rápidas</div>
              {[
                { icon: '👥', label: 'Agregar profesional',   sub: 'Crear cuenta de trabajador',     path: '/users' },
                { icon: '📅', label: 'Programar turno',       sub: 'Asignar turno a un profesional',  path: '/shifts' },
                { icon: '🗂',  label: 'Subir documento',       sub: 'Contratos, protocolos, etc.',     path: '/documents' },
                { icon: '💰', label: 'Revisar boletas',       sub: 'Honorarios pendientes de pago',   path: '/boletas' },
              ].map(a => (
                <div key={a.label} className="notif-row" style={{ cursor: 'pointer' }} onClick={() => navigate(a.path)}>
                  <div className="notif-icon" style={{ background: 'var(--slate-100)', fontSize: 18 }}>{a.icon}</div>
                  <div><div className="notif-title">{a.label}</div><div className="notif-sub">{a.sub}</div></div>
                  <span style={{ color: 'var(--text-4)', fontSize: 18 }}>›</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
