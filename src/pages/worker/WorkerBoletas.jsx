import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const PAY_STATUS = {
  pending:    { cls: 'badge-amber', label: '⏳ Pendiente',   icon: '⏳' },
  in_process: { cls: 'badge-blue',  label: '🔄 En proceso',  icon: '🔄' },
  paid:       { cls: 'badge-green', label: '✅ Pagado',       icon: '✅' },
}

export default function WorkerBoletas() {
  const { user } = useAuth()
  const [payments,   setPayments]   = useState([])   // admin-assigned payments
  const [shifts,     setShifts]     = useState([])   // all shifts for earnings calc
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('resumen') // resumen | pagos | detalle

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    const [{ data: pay }, { data: sh }] = await Promise.all([
      supabase.from('payments').select('*').eq('worker_id', user.id).order('period_year', { ascending: false }).order('period_month', { ascending: false }),
      supabase.from('shifts').select('*').eq('worker_id', user.id).in('status', ['completed', 'late']).order('shift_date', { ascending: false }),
    ])
    setPayments(pay || [])
    setShifts(sh || [])
    setLoading(false)
  }

  // Group shifts by month for earnings
  const earningsByMonth = shifts.reduce((acc, s) => {
    const d = new Date(s.shift_date + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!acc[key]) acc[key] = { month: d.getMonth() + 1, year: d.getFullYear(), shifts: [], total: 0 }
    acc[key].shifts.push(s)
    acc[key].total += s.fee || 0
    return acc
  }, {})

  // Current month
  const thisMonthKey   = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
  const thisMonthEarn  = earningsByMonth[thisMonthKey] || { shifts: [], total: 0 }
  const totalEarned    = shifts.reduce((a, s) => a + (s.fee || 0), 0)
  const totalPaid      = payments.filter(p => p.status === 'paid').reduce((a, p) => a + (p.amount || 0), 0)
  const totalPending   = payments.filter(p => p.status !== 'paid').reduce((a, p) => a + (p.amount || 0), 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mis Pagos</div>
          <div className="topbar-sub">Honorarios y estado de pagos</div>
        </div>
      </div>

      <div className="content">
        {/* Summary cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
          {[
            { label: 'Ganado este mes', value: thisMonthEarn.total > 0 ? `$${(thisMonthEarn.total/1000).toFixed(0)}K` : '$0', accent: 'accent-teal', icon: '💰', ibg: 'var(--teal-l)', icl: 'var(--teal)', delta: `${thisMonthEarn.shifts.length} turno${thisMonthEarn.shifts.length !== 1 ? 's' : ''}` },
            { label: 'Pagos pendientes', value: totalPending > 0 ? `$${(totalPending/1000).toFixed(0)}K` : '$0', accent: totalPending > 0 ? 'accent-amber' : 'accent-green', icon: '⏳', ibg: totalPending > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: totalPending > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: totalPending > 0 ? 'CLP pendientes' : '✓ Sin pendientes' },
            { label: 'Total recibido', value: totalPaid > 0 ? `$${(totalPaid/1000).toFixed(0)}K` : '$0', accent: 'accent-green', icon: '✅', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)', delta: 'CLP histórico' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.ibg, color: s.icl }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: String(s.value).length > 5 ? 18 : undefined }}>{s.value}</div>
              <div className="stat-delta">{s.delta}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[['resumen','Resumen'],['pagos','Mis pagos'],['detalle','Por turno']].map(([v, l]) => (
            <div key={v} className={`tab ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</div>
          ))}
        </div>

        {/* ── RESUMEN TAB ── */}
        {tab === 'resumen' && (
          <div>
            {/* Current month detail */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>
                💰 {MONTHS[currentMonth]} {currentYear}
              </div>
              <div className="card-sub" style={{ marginBottom: 16 }}>Honorarios del mes en curso</div>

              {thisMonthEarn.shifts.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <div className="empty-state-icon">📅</div>
                  <div className="empty-state-title">Sin turnos completados este mes</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '12px 16px', background: 'var(--emerald-l)', borderRadius: 'var(--r)', border: '1px solid #6ee7b7' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--emerald-d)', fontWeight: 600 }}>Total ganado este mes</div>
                      <div style={{ fontSize: 11, color: 'var(--emerald-d)', opacity: 0.7 }}>{thisMonthEarn.shifts.length} turnos completados</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 20, color: 'var(--emerald-d)' }}>
                      ${thisMonthEarn.total.toLocaleString('es-CL')}
                    </div>
                  </div>

                  {thisMonthEarn.shifts.slice(0, 5).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{s.project || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{s.shift_date} · {s.start_time}–{s.end_time}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: s.fee ? 'var(--text-1)' : 'var(--text-4)' }}>
                        {s.fee ? `$${Number(s.fee).toLocaleString('es-CL')}` : '—'}
                      </span>
                    </div>
                  ))}
                  {thisMonthEarn.shifts.length > 5 && (
                    <div style={{ fontSize: 12, color: 'var(--text-4)', textAlign: 'center', marginTop: 10 }}>
                      + {thisMonthEarn.shifts.length - 5} turnos más · ve a "Por turno"
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Monthly history */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Resumen por mes</div>
              {Object.entries(earningsByMonth).sort(([a], [b]) => b.localeCompare(a)).map(([key, data]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{MONTHS[data.month]} {data.year}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{data.shifts.length} turno{data.shifts.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: 'var(--emerald)' }}>
                    ${data.total.toLocaleString('es-CL')}
                  </div>
                </div>
              ))}
              {Object.keys(earningsByMonth).length === 0 && (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state-icon">💰</div>
                  <div className="empty-state-title">Sin historial de honorarios</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PAGOS TAB ── */}
        {tab === 'pagos' && (
          <div>
            {payments.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 40 }}>
                <div className="empty-state-icon">💳</div>
                <div className="empty-state-title">Sin pagos asignados aún</div>
                <div className="empty-state-sub">La administración asignará tus pagos aquí</div>
              </div>
            ) : (
              payments.map(p => {
                const s = PAY_STATUS[p.status] || PAY_STATUS.pending
                return (
                  <div key={p.id} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                    {/* Color bar */}
                    <div style={{ height: 4, background: p.status === 'paid' ? 'linear-gradient(90deg,var(--emerald),#34d399)' : p.status === 'in_process' ? 'linear-gradient(90deg,var(--navy-500),var(--navy-300))' : 'linear-gradient(90deg,var(--amber),#fbbf24)' }} />
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>
                            {s.icon} {MONTHS[p.period_month]} {p.period_year}
                          </div>
                          {p.description && (
                            <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{p.description}</div>
                          )}
                        </div>
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: p.status === 'paid' ? 'var(--emerald)' : 'var(--text-1)' }}>
                          ${p.amount.toLocaleString('es-CL')} CLP
                        </div>
                        {p.paid_at && (
                          <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                            Pagado: {p.paid_at.slice(0, 10)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── DETALLE TAB — all shifts ── */}
        {tab === 'detalle' && (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Proyecto</th><th>Horario</th><th>Estado</th><th>Honorario</th></tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr><td colSpan={5}>
                      <div className="empty-state" style={{ padding: '32px 0' }}>
                        <div className="empty-state-icon">📅</div>
                        <div className="empty-state-title">Sin turnos completados</div>
                      </div>
                    </td></tr>
                  ) : shifts.map(s => {
                    const b = { completed: 'badge-green', late: 'badge-amber' }
                    return (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.shift_date}</td>
                        <td>{s.project ? <span className="badge badge-blue">{s.project}</span> : '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.start_time}–{s.end_time}</td>
                        <td><span className={`badge ${b[s.status] || 'badge-gray'}`}>{STATUS[s.status]?.label || s.status}</span></td>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>
                          {s.fee ? `$${Number(s.fee).toLocaleString('es-CL')}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
