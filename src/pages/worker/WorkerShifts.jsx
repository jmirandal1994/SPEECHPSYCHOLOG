import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const STATUS = {
  completed:   { cls: 'badge-green', label: '✓ Completado', icon: '✅' },
  in_progress: { cls: 'badge-teal',  label: '● En curso',   icon: '🔄' },
  scheduled:   { cls: 'badge-gray',  label: 'Programado',   icon: '📅' },
  late:        { cls: 'badge-amber', label: '⚠ Con atraso', icon: '⏰' },
  absent:      { cls: 'badge-red',   label: 'Inasistencia', icon: '❌' },
}

export default function WorkerShifts() {
  const { user } = useAuth()
  const [shifts,    setShifts]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [viewMode,  setViewMode]  = useState('list') // list | calendar
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth())
  const [yearFilter,  setYearFilter]  = useState(new Date().getFullYear())

  const now        = new Date()
  const monthStart = new Date(yearFilter, monthFilter, 1).toISOString().slice(0, 10)
  const monthEnd   = new Date(yearFilter, monthFilter + 1, 0).toISOString().slice(0, 10)
  const monthLabel = `${MONTHS[monthFilter]} ${yearFilter}`

  useEffect(() => {
    if (user) loadShifts()
  }, [user, monthFilter, yearFilter])

  async function loadShifts() {
    setLoading(true)
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('worker_id', user.id)
      .gte('shift_date', monthStart)
      .lte('shift_date', monthEnd)
      .order('shift_date', { ascending: false })
    setShifts(data || [])
    setLoading(false)
  }

  function prevMonth() {
    if (monthFilter === 0) { setMonthFilter(11); setYearFilter(y => y - 1) }
    else setMonthFilter(m => m - 1)
  }
  function nextMonth() {
    const futureMonth = monthFilter === 11 ? 0 : monthFilter + 1
    const futureYear  = monthFilter === 11 ? yearFilter + 1 : yearFilter
    if (futureYear > now.getFullYear() || (futureYear === now.getFullYear() && futureMonth > now.getMonth())) return
    if (monthFilter === 11) { setMonthFilter(0); setYearFilter(y => y + 1) }
    else setMonthFilter(m => m + 1)
  }

  const done     = shifts.filter(s => s.status === 'completed' || s.status === 'late')
  const totalFee = done.reduce((a, b) => a + (b.fee || 0), 0)
  const lateC    = shifts.filter(s => s.status === 'late').length
  const upcoming = shifts.filter(s => s.status === 'scheduled').length

  // Group by date
  const byDate = shifts.reduce((acc, s) => {
    if (!acc[s.shift_date]) acc[s.shift_date] = []
    acc[s.shift_date].push(s)
    return acc
  }, {})

  function fmtDate(str) {
    const d = new Date(str + 'T12:00:00')
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    return `${days[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mis Turnos</div>
          <div className="topbar-sub">{monthLabel}</div>
        </div>
      </div>

      <div className="content">
        {/* Month navigator */}
        <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button className="btn btn-sm" onClick={prevMonth}>← Anterior</button>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-1)' }}>
              {monthLabel}
            </div>
            <button
              className="btn btn-sm"
              onClick={nextMonth}
              disabled={yearFilter === now.getFullYear() && monthFilter >= now.getMonth()}
              style={{ opacity: yearFilter === now.getFullYear() && monthFilter >= now.getMonth() ? 0.4 : 1 }}
            >
              Siguiente →
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
          {[
            { label: 'Completados', value: done.length, accent: 'accent-green', icon: '✔', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)', delta: monthLabel },
            { label: 'Programados', value: upcoming, accent: 'accent-blue', icon: '📅', ibg: 'var(--navy-200)', icl: 'var(--navy-700)', delta: 'Próximos' },
            { label: 'Atrasos', value: lateC, accent: lateC > 0 ? 'accent-amber' : 'accent-green', icon: '⏰', ibg: lateC > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: lateC > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: lateC === 0 ? '✓ Sin atrasos' : `⚠ ${lateC}` },
            { label: 'Honorarios', value: totalFee > 0 ? `$${totalFee.toLocaleString('es-CL')}` : '$0', accent: 'accent-teal', icon: '💰', ibg: 'var(--teal-l)', icl: 'var(--teal)', delta: totalFee > 0 ? 'CLP acumulado' : 'Sin honorarios' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.ibg, color: s.icl, fontSize: 15 }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: String(s.value).length > 4 ? 20 : undefined }}>{s.value}</div>
              <div className="stat-delta">{s.delta}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : shifts.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">Sin turnos en {monthLabel}</div>
            <div className="empty-state-sub">Los turnos asignados aparecerán aquí</div>
          </div>
        ) : (
          /* Grouped by day */
          Object.entries(byDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayShifts]) => (
              <div key={date} className="card" style={{ marginBottom: 12, overflow: 'hidden', padding: 0 }}>
                {/* Day header */}
                <div style={{
                  padding: '12px 18px',
                  background: 'var(--slate-50)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                    {fmtDate(date)}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {dayShifts.some(s => s.fee) && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13, color: 'var(--emerald)' }}>
                        💰 ${dayShifts.reduce((a, s) => a + (s.fee || 0), 0).toLocaleString('es-CL')}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {dayShifts.length} turno{dayShifts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Shifts of the day */}
                {dayShifts.map(s => {
                  const b = STATUS[s.status] || STATUS.scheduled
                  const isToday = date === now.toISOString().slice(0, 10)
                  return (
                    <div key={s.id} style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border)',
                      background: isToday ? 'var(--navy-50)' : undefined,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{b.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>
                              {s.project || 'Sin proyecto'}
                              {isToday && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--navy-100)', padding: '2px 7px', borderRadius: 20 }}>HOY</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              {s.start_time} – {s.end_time}
                            </div>
                          </div>
                        </div>
                        <span className={`badge ${b.cls}`}>{b.label}</span>
                      </div>

                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {s.fee && (
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--emerald)', fontFamily: 'var(--font-mono)' }}>
                            💰 ${Number(s.fee).toLocaleString('es-CL')} CLP
                          </div>
                        )}
                        {s.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic' }}>
                            📝 {s.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
        )}
      </div>
    </div>
  )
}
