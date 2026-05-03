import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function WorkerHome() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [todayShift, setTodayShift] = useState(null)
  const [checkin, setCheckin]       = useState(null)
  const [stats, setStats]           = useState({ shifts: 0, late: 0, fees: 0 })
  const [loading, setLoading]       = useState(true)
  const [elapsed, setElapsed]       = useState(0)

  const now        = new Date()
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayStr   = now.toISOString().slice(0, 10)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  // Timer for active shift
  useEffect(() => {
    if (!checkin?.checked_in_at) return
    const start = new Date(checkin.checked_in_at).getTime()
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [checkin])

  async function loadData() {
    setLoading(true)
    const [
      { data: shiftData },
      { data: checkinData },
      { count: shiftCount },
      { count: lateCount },
      { data: boletaData },
    ] = await Promise.all([
      supabase.from('shifts').select('*').eq('worker_id', user.id).eq('shift_date', todayStr).single(),
      supabase.from('attendances').select('*').eq('worker_id', user.id).gte('checked_in_at', todayStr).is('checked_out_at', null).maybeSingle(),
      supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('worker_id', user.id).eq('status', 'completed').gte('shift_date', monthStart),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('worker_id', user.id).eq('status', 'late').gte('checked_in_at', monthStart),
      supabase.from('boletas').select('amount').eq('worker_id', user.id).gte('created_at', monthStart),
    ])
    setTodayShift(shiftData)
    setCheckin(checkinData)
    setStats({
      shifts: shiftCount || 0,
      late:   lateCount  || 0,
      fees:   (boletaData || []).reduce((s, b) => s + (b.amount || 0), 0),
    })
    setLoading(false)
  }

  const fmtElapsed = () => {
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
    const s = String(elapsed % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Profesional'

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mi Panel</div>
          <div className="topbar-sub">{monthLabel}</div>
        </div>
      </div>

      <div className="content">
        {loading ? (
          <div className="empty-state" style={{ marginTop: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
        ) : (
          <>
            {/* Welcome */}
            <div className="card" style={{ background: 'linear-gradient(135deg,var(--navy-800),var(--navy-900))', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: 4 }}>
                    Buen día, {firstName} 👋
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    {profile?.role_label || 'Profesional'}{profile?.project ? ` · ${profile.project}` : ''}
                  </div>
                </div>
                {checkin && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                      {fmtElapsed()}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Tiempo en turno</div>
                  </div>
                )}
              </div>
            </div>

            {/* Today shift */}
            {todayShift ? (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">Tu turno de hoy</div>
                    <div className="card-sub">{todayStr}</div>
                  </div>
                  <span className={`badge ${checkin ? 'badge-live' : 'badge-gray'}`}>
                    {checkin ? '● En curso' : 'Sin marcar'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[
                    ['📅', 'Horario', `${todayShift.start_time} – ${todayShift.end_time}`],
                    ['🏥', 'Proyecto', todayShift.project || '—'],
                    ['📍', 'Entrada', checkin ? new Date(checkin.checked_in_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + ' ✓' : 'Sin registrar'],
                  ].map(([ic, l, v]) => (
                    <div key={l} style={{ flex: 1, minWidth: 120, padding: '12px 14px', background: 'var(--slate-50)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>{ic} {l}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {!checkin && (
                  <button className="btn btn-primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={() => navigate('/w/checkin')}>
                    📍 Marcar entrada ahora
                  </button>
                )}
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="empty-state" style={{ padding: '28px 0' }}>
                  <div className="empty-state-icon">📅</div>
                  <div className="empty-state-title">Sin turno programado para hoy</div>
                  <div className="empty-state-sub">Consulta tus próximos turnos en "Mis turnos"</div>
                  <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => navigate('/w/shifts')}>Ver mis turnos →</button>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {[
                { label: 'Turnos completados', value: stats.shifts, accent: 'accent-green', icon: '✔', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)', delta: monthLabel },
                { label: 'Atrasos en el mes',  value: stats.late,   accent: stats.late > 0 ? 'accent-amber' : 'accent-green', icon: '⏰', ibg: stats.late > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: stats.late > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: stats.late === 0 ? '✓ Sin atrasos' : `⚠ ${stats.late} incidencia${stats.late > 1 ? 's' : ''}`, deltaClass: stats.late > 0 ? 'warn' : '' },
                { label: 'Honorarios enviados', value: stats.fees > 0 ? `$${(stats.fees/1000).toFixed(0)}K` : '$0', accent: 'accent-teal', icon: '💰', ibg: 'var(--teal-l)', icl: 'var(--teal)', delta: 'CLP · mes actual' },
              ].map(s => (
                <div className="stat-card" key={s.label}>
                  <div className={`stat-accent-bar ${s.accent}`} />
                  <div className="stat-icon" style={{ background: s.ibg, color: s.icl }}>{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className={`stat-delta ${s.deltaClass || ''}`}>{s.delta}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Acciones</div>
              {[
                { icon: '📍', label: 'Marcar asistencia',  sub: 'Registrar entrada o salida',    path: '/w/checkin' },
                { icon: '📅', label: 'Ver mis turnos',      sub: 'Historial y próximos turnos',   path: '/w/shifts' },
                { icon: '📋', label: 'Enviar solicitud',    sub: 'Inasistencia, reclamo, cambio', path: '/w/requests' },
                { icon: '💰', label: 'Enviar boleta',       sub: 'Subir boleta de honorarios',    path: '/w/boletas' },
              ].map(a => (
                <div key={a.label} className="notif-row" style={{ cursor: 'pointer' }} onClick={() => navigate(a.path)}>
                  <div className="notif-icon" style={{ background: 'var(--slate-100)', fontSize: 18 }}>{a.icon}</div>
                  <div><div className="notif-title">{a.label}</div><div className="notif-sub">{a.sub}</div></div>
                  <span style={{ color: 'var(--text-4)', fontSize: 18 }}>›</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
