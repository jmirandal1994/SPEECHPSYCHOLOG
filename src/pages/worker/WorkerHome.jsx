import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function WorkerHome() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [todayShift,  setTodayShift]  = useState(null)
  const [attendance,  setAttendance]  = useState(null)
  const [stats,       setStats]       = useState({ shifts: 0, late: 0, fees: 0, pendingPay: 0 })
  const [loading,     setLoading]     = useState(true)
  const [elapsed,     setElapsed]     = useState(0)

  const now        = new Date()
  const todayStr   = now.toISOString().slice(0, 10)
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const firstName  = profile?.full_name?.split(' ')[0] || 'Profesional'

  useEffect(() => { if (user) loadData() }, [user])

  useEffect(() => {
    if (!attendance?.checked_in_at || attendance?.checked_out_at) return
    const start = new Date(attendance.checked_in_at).getTime()
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [attendance])

  async function loadData() {
    setLoading(true)
    const [
      { data: shift },
      { data: att },
      { count: shiftCount },
      { count: lateCount },
      { data: shiftFees },
      { data: pendingPay },
    ] = await Promise.all([
      supabase.from('shifts').select('*').eq('worker_id', user.id).eq('shift_date', todayStr).maybeSingle(),
      supabase.from('attendances').select('*').eq('worker_id', user.id).gte('checked_in_at', todayStr + 'T00:00:00').lte('checked_in_at', todayStr + 'T23:59:59').maybeSingle(),
      supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('worker_id', user.id).in('status', ['completed', 'late']).gte('shift_date', monthStart),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('worker_id', user.id).eq('status', 'late').gte('checked_in_at', monthStart),
      supabase.from('shifts').select('fee').eq('worker_id', user.id).in('status', ['completed','late']).gte('shift_date', monthStart),
      supabase.from('payments').select('amount').eq('worker_id', user.id).neq('status', 'paid'),
    ])
    setTodayShift(shift)
    setAttendance(att)
    setStats({
      shifts:     shiftCount || 0,
      late:       lateCount  || 0,
      fees:       (shiftFees || []).reduce((a, s) => a + (s.fee || 0), 0),
      pendingPay: (pendingPay || []).reduce((a, p) => a + (p.amount || 0), 0),
    })
    setLoading(false)
  }

  const fmtElapsed = () => {
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
    return `${h}:${m}`
  }

  const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )

  const inShift = attendance && !attendance.checked_out_at

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Inicio</div>
          <div className="topbar-sub">{monthLabel}</div>
        </div>
      </div>

      <div className="content">
        {/* Welcome */}
        <div className="card" style={{ background: 'linear-gradient(135deg,var(--navy-800),var(--navy-900))', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: 4 }}>
                Hola, {firstName} 👋
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                {profile?.role_label}{profile?.project ? ` · ${profile.project}` : ''}
              </div>
            </div>
            {inShift && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: '#22c55e' }}>{fmtElapsed()}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>● En turno</div>
              </div>
            )}
          </div>
        </div>

        {/* Today's shift */}
        {todayShift ? (
          <div className="card" style={{ marginBottom: 16, borderColor: inShift ? 'var(--emerald)' : undefined }}>
            <div className="card-header" style={{ marginBottom: 14 }}>
              <div>
                <div className="card-title">Turno de hoy</div>
                <div className="card-sub">{todayStr}</div>
              </div>
              <span className={`badge ${inShift ? 'badge-live' : attendance?.checked_out_at ? 'badge-green' : 'badge-gray'}`}>
                {inShift ? '● En curso' : attendance?.checked_out_at ? '✓ Completado' : 'Sin marcar'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                ['🏥', 'Proyecto', todayShift.project || '—'],
                ['⏰', 'Horario', `${todayShift.start_time} – ${todayShift.end_time}`],
                ['📍', 'Entrada', attendance ? fmtTime(attendance.checked_in_at) : '—'],
                ['💰', 'Honorario', todayShift.fee ? `$${Number(todayShift.fee).toLocaleString('es-CL')}` : '—'],
              ].map(([ic, l, v]) => (
                <div key={l} style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>{ic} {l}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', fontFamily: l === 'Honorario' || l === 'Entrada' || l === 'Horario' ? 'var(--font-mono)' : undefined }}>{v}</div>
                </div>
              ))}
            </div>

            {!attendance && (
              <button
                className="checkin-btn-primary"
                style={{ background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff', boxShadow: '0 6px 24px rgba(5,150,105,0.4)' }}
                onClick={() => navigate('/w/checkin')}
              >
                <span style={{ fontSize: 20 }}>📍</span> Marcar entrada
              </button>
            )}
            {inShift && (
              <button
                className="checkin-btn-primary"
                style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', boxShadow: '0 6px 24px rgba(220,38,38,0.3)' }}
                onClick={() => navigate('/w/checkin')}
              >
                <span style={{ fontSize: 20 }}>🚪</span> Marcar salida
              </button>
            )}
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
            <div style={{ fontWeight: 600, color: 'var(--text-2)', fontSize: 14 }}>Sin turno asignado hoy</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>Contacta a la administración si crees que es un error</div>
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 16 }}>
          {[
            { label: 'Turnos este mes', value: stats.shifts, accent: 'accent-green', icon: '✔', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)', delta: monthLabel },
            { label: 'Atrasos', value: stats.late, accent: stats.late > 0 ? 'accent-amber' : 'accent-green', icon: '⏰', ibg: stats.late > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: stats.late > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: stats.late === 0 ? '✓ Sin atrasos' : '⚠ Revisa' },
            { label: 'Honorarios mes', value: stats.fees > 0 ? `$${(stats.fees/1000).toFixed(0)}K` : '$0', accent: 'accent-teal', icon: '💰', ibg: 'var(--teal-l)', icl: 'var(--teal)', delta: 'CLP ganados' },
            { label: 'Pagos pendientes', value: stats.pendingPay > 0 ? `$${(stats.pendingPay/1000).toFixed(0)}K` : '$0', accent: stats.pendingPay > 0 ? 'accent-amber' : 'accent-green', icon: '⏳', ibg: stats.pendingPay > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: stats.pendingPay > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: 'CLP por cobrar' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.ibg, color: s.icl, fontSize: 15 }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: String(s.value).length > 5 ? 18 : undefined }}>{s.value}</div>
              <div className="stat-delta">{s.delta}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Acciones rápidas</div>
          {[
            { icon: '📍', label: 'Marcar asistencia', sub: 'Registrar entrada o salida', path: '/w/checkin' },
            { icon: '📅', label: 'Ver mis turnos',    sub: 'Historial y honorarios por día', path: '/w/shifts' },
            { icon: '💰', label: 'Mis pagos',          sub: 'Estado de pagos y honorarios', path: '/w/boletas' },
            { icon: '📋', label: 'Enviar solicitud',   sub: 'Inasistencia, reclamo, cambio', path: '/w/requests' },
          ].map(a => (
            <div key={a.path} className="notif-row" style={{ cursor: 'pointer' }} onClick={() => navigate(a.path)}>
              <div className="notif-icon" style={{ background: 'var(--slate-100)', fontSize: 18 }}>{a.icon}</div>
              <div><div className="notif-title">{a.label}</div><div className="notif-sub">{a.sub}</div></div>
              <span style={{ color: 'var(--text-4)', fontSize: 20 }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
