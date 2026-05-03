import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const STATUS_MAP = {
  completed:   { cls: 'badge-green', label: 'Completado' },
  in_progress: { cls: 'badge-teal',  label: '● En curso' },
  scheduled:   { cls: 'badge-gray',  label: 'Programado' },
  late:        { cls: 'badge-amber', label: '⚠ Con atraso' },
  absent:      { cls: 'badge-red',   label: 'Inasistencia' },
}
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function WorkerShifts() {
  const { user } = useAuth()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  const now        = new Date()
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  useEffect(() => {
    if (user) {
      supabase.from('shifts').select('*').eq('worker_id', user.id).order('shift_date', { ascending: false })
        .then(({ data }) => { setShifts(data || []); setLoading(false) })
    } else setLoading(false)
  }, [user])

  const thisMonth  = shifts.filter(s => s.shift_date >= monthStart.slice(0, 10))
  const completed  = thisMonth.filter(s => s.status === 'completed' || s.status === 'late').length
  const lateCount  = thisMonth.filter(s => s.status === 'late').length
  const totalFees  = thisMonth.filter(s => s.status === 'completed' || s.status === 'late').reduce((a, b) => a + (b.fee || 0), 0)

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mis Turnos</div>
          <div className="topbar-sub">{monthLabel}</div>
        </div>
      </div>

      <div className="content">
        {loading ? (
          <div className="empty-state" style={{ marginTop: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
        ) : shifts.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 80 }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">Sin turnos registrados</div>
            <div className="empty-state-sub">Tus turnos asignados aparecerán aquí</div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
              {[
                { label: 'Completados', value: completed, accent: 'accent-green', icon: '✔', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)', delta: monthLabel },
                { label: 'Programados', value: thisMonth.filter(s => s.status === 'scheduled').length, accent: 'accent-blue', icon: '📅', ibg: 'var(--navy-200)', icl: 'var(--navy-700)', delta: 'Próximos turnos' },
                { label: 'Atrasos', value: lateCount, accent: lateCount > 0 ? 'accent-amber' : 'accent-green', icon: '⏰', ibg: lateCount > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: lateCount > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: lateCount === 0 ? '✓ Sin atrasos' : `⚠ Límite: 2`, deltaClass: lateCount > 0 ? 'warn' : '' },
                { label: 'Honorarios', value: totalFees > 0 ? `$${(totalFees/1000).toFixed(0)}K` : '$0', accent: 'accent-teal', icon: '💰', ibg: 'var(--teal-l)', icl: 'var(--teal)', delta: 'CLP · mes actual' },
              ].map(s => (
                <div className="stat-card" key={s.label}>
                  <div className={`stat-accent-bar ${s.accent}`} />
                  <div className="stat-icon" style={{ background: s.ibg, color: s.icl, fontSize: 15 }}>{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ fontSize: String(s.value).length > 4 ? 20 : undefined }}>{s.value}</div>
                  <div className={`stat-delta ${s.deltaClass || ''}`}>{s.delta}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Horario</th><th>Proyecto</th><th>Estado</th><th>Honorario</th></tr>
                  </thead>
                  <tbody>
                    {shifts.map(s => {
                      const b = STATUS_MAP[s.status] || STATUS_MAP.scheduled
                      return (
                        <tr key={s.id} style={s.status === 'late' ? { background: '#fffbeb' } : {}}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.shift_date}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.start_time} – {s.end_time}</td>
                          <td>{s.project ? <span className="badge badge-blue">{s.project}</span> : '—'}</td>
                          <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                          <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                            {s.fee ? `$${Number(s.fee).toLocaleString('es-CL')}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
