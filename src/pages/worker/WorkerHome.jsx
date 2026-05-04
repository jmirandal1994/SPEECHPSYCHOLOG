import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtCLP(n) {
  if (!n && n !== 0) return '$0'
  return `$${Number(n).toLocaleString('es-CL')}`
}

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
  const firstName  = (profile?.full_name || 'Profesional').split(' ')[0]

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
      supabase.from('shifts').select('fee').eq('worker_id', user.id).in('status', ['completed', 'late']).gte('shift_date', monthStart),
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
  const inShift = attendance && !attendance.checked_out_at

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Inicio</div>
          <div className="topbar-sub">{monthLabel}</div>
        </div>
      </div>

      <div className="content">
        {/* Welcome banner */}
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
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>● En turno</div>
              </div>
            )}
          </div>
        </div>

        {/* Today shift card */}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                ['🏥', 'Proyecto',  todayShift.project || '—'],
                ['⏰', 'Horario',   `${todayShift.start_time} – ${todayShift.end_time}`],
                ['📍', 'Entrada',   attendance ? fmtTime(attendance.checked_in_at) : '—'],
                ['💰', 'Honorario', todayShift.fee ? `${fmtCLP(todayShift.fee)} CLP` : '—'],
              ].map(([ic, l, v]) => (
                <div key={l} style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>{ic} {l}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', fontFamily: ['Honorario','Entrada','Horario'].includes(l) ? 'var(--font-mono)' : undefined }}>{v}</div>
                </div>
              ))}
            </div>

            {!attendance && (
              <button className="checkin-btn-primary" style={{ background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff', boxShadow: '0 6px 24px rgba(5,150,105,0.4)' }} onClick={() => navigate('/w/checkin')}>
                <span style={{ fontSize: 20 }}>📍</span> Marcar entrada
              </button>
            )}
            {inShift && (
              <button className="checkin-btn-primary" style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', boxShadow: '0 6px 24px rgba(220,38,38,0.3)' }} onClick={() => navigate('/w/checkin')}>
                <span style={{ fontSize: 20 }}>🚪</span> Marcar salida
              </button>
            )}
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--navy-300)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>📍</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 3 }}>¿Listo para comenzar?</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>
                  Puedes marcar tu asistencia directamente. El sistema registrará tu turno automáticamente.
                </div>
              </div>
            </div>
            <button
              className="checkin-btn-primary"
              style={{ background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff', boxShadow: '0 6px 24px rgba(5,150,105,0.4)' }}
              onClick={() => navigate('/w/checkin')}
            >
              <span style={{ fontSize: 20 }}>📍</span> Marcar entrada ahora
            </button>
          </div>
        )}

        {/* Stats — FULL FORMAT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

          {/* Turnos */}
          <div className="stat-card">
            <div className="stat-accent-bar accent-green"/>
            <div className="stat-icon" style={{ background: 'var(--emerald-l)', color: 'var(--emerald-d)' }}>✔</div>
            <div className="stat-label">Turnos este mes</div>
            <div className="stat-value">{stats.shifts}</div>
            <div className="stat-delta">{monthLabel}</div>
          </div>

          {/* Atrasos */}
          <div className="stat-card">
            <div className={`stat-accent-bar ${stats.late > 0 ? 'accent-amber' : 'accent-green'}`}/>
            <div className="stat-icon" style={{ background: stats.late > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', color: stats.late > 0 ? 'var(--amber)' : 'var(--emerald-d)' }}>⏰</div>
            <div className="stat-label">Atrasos</div>
            <div className="stat-value">{stats.late}</div>
            <div className={`stat-delta ${stats.late > 0 ? 'warn' : ''}`}>{stats.late === 0 ? '✓ Sin atrasos' : '⚠ Revisar'}</div>
          </div>

          {/* Honorarios — FULL FORMAT */}
          <div className="stat-card">
            <div className="stat-accent-bar accent-teal"/>
            <div className="stat-icon" style={{ background: 'var(--teal-l)', color: 'var(--teal)' }}>💰</div>
            <div className="stat-label">Honorarios del mes</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--text-1)', lineHeight: 1.1, marginTop: 6, letterSpacing: '-0.02em' }}>
              {fmtCLP(stats.fees)}
            </div>
            <div className="stat-delta" style={{ marginTop: 6 }}>CLP · {monthLabel}</div>
          </div>

          {/* Pagos pendientes — FULL FORMAT */}
          <div className="stat-card">
            <div className={`stat-accent-bar ${stats.pendingPay > 0 ? 'accent-amber' : 'accent-green'}`}/>
            <div className="stat-icon" style={{ background: stats.pendingPay > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', color: stats.pendingPay > 0 ? 'var(--amber)' : 'var(--emerald-d)' }}>⏳</div>
            <div className="stat-label">Pagos pendientes</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--text-1)', lineHeight: 1.1, marginTop: 6, letterSpacing: '-0.02em' }}>
              {fmtCLP(stats.pendingPay)}
            </div>
            <div className={`stat-delta ${stats.pendingPay > 0 ? 'warn' : ''}`} style={{ marginTop: 6 }}>
              {stats.pendingPay > 0 ? 'CLP por cobrar' : '✓ Sin pendientes'}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Acciones rápidas</div>
          {[
            { icon: '📍', label: 'Marcar asistencia',  sub: 'Registrar entrada o salida del turno', path: '/w/checkin' },
            { icon: '📅', label: 'Ver mis turnos',      sub: 'Historial y honorarios por día',       path: '/w/shifts' },
            { icon: '💰', label: 'Mis pagos',           sub: 'Estado de pagos y honorarios',          path: '/w/boletas' },
            { icon: '📋', label: 'Enviar solicitud',    sub: 'Inasistencia, reclamo o cambio',        path: '/w/requests' },
          ].map(a => (
            <div key={a.path} className="notif-row" style={{ cursor: 'pointer' }} onClick={() => navigate(a.path)}>
              <div className="notif-icon" style={{ background: 'var(--slate-100)', fontSize: 18 }}>{a.icon}</div>
              <div>
                <div className="notif-title">{a.label}</div>
                <div className="notif-sub">{a.sub}</div>
              </div>
              <span style={{ color: 'var(--text-4)', fontSize: 20 }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
