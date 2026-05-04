import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Full amount formatter
function fmtCLP(amount) {
  if (!amount && amount !== 0) return '—'
  return `$${Number(amount).toLocaleString('es-CL')} CLP`
}

const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const STATUS_MAP = {
  paid:       { cls: 'badge-green', label: '✅ Pagado' },
  in_process: { cls: 'badge-blue',  label: '🔄 En proceso' },
  pending:    { cls: 'badge-amber', label: '⏳ Pendiente' },
}

export default function Boletas() {
  const [workers,  setWorkers]  = useState([])
  const [payments, setPayments] = useState([])
  const [shifts,   setShifts]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('payments')  // payments | assign
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const now = new Date()
  const [form, setForm] = useState({
    worker_id:    '',
    amount:       '',
    period_month: now.getMonth() + 1,
    period_year:  now.getFullYear(),
    status:       'pending',
    description:  '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: w }, { data: p }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role_label, project').eq('role', 'worker').eq('status', 'active').order('full_name'),
      supabase.from('payments').select('*, profiles(full_name, role_label, project)').order('period_year', { ascending: false }).order('period_month', { ascending: false }),
      supabase.from('shifts').select('worker_id, fee, shift_date, status').in('status', ['completed', 'late']),
    ])
    setWorkers(w || [])
    setPayments(p || [])
    setShifts(s || [])
    setLoading(false)
  }

  // Calculate earnings from shifts per worker per month
  function getWorkerEarnings(workerId, month, year) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end   = `${year}-${String(month).padStart(2, '0')}-31`
    return shifts
      .filter(s => s.worker_id === workerId && s.shift_date >= start && s.shift_date <= end)
      .reduce((a, s) => a + (s.fee || 0), 0)
  }

  function f(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  async function handleAssign(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (!form.worker_id || !form.amount) { setError('Selecciona un profesional e ingresa el monto'); setSaving(false); return }

    const { error: err } = await supabase.from('payments').insert([{
      worker_id:    form.worker_id,
      amount:       Number(form.amount),
      period_month: Number(form.period_month),
      period_year:  Number(form.period_year),
      status:       form.status,
      description:  form.description || null,
    }])

    if (err) {
      setError(err.message)
    } else {
      setForm({ worker_id: '', amount: '', period_month: now.getMonth() + 1, period_year: now.getFullYear(), status: 'pending', description: '' })
      loadData()
      setTab('payments')
    }
    setSaving(false)
  }

  async function updateStatus(id, status) {
    const updates = { status }
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    await supabase.from('payments').update(updates).eq('id', id)
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  async function deletePayment(id) {
    if (!confirm('¿Eliminar este pago?')) return
    await supabase.from('payments').delete().eq('id', id)
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  // Auto-calculate from shifts
  function autoCalc() {
    if (!form.worker_id) { setError('Selecciona un profesional primero'); return }
    const earned = getWorkerEarnings(form.worker_id, form.period_month, form.period_year)
    if (earned > 0) f('amount', String(earned))
    else setError('No hay turnos completados para este profesional en ese período')
  }

  const totalPending   = payments.filter(p => p.status !== 'paid').reduce((a, p) => a + (p.amount || 0), 0)
  const totalPaid      = payments.filter(p => p.status === 'paid').reduce((a, p) => a + (p.amount || 0), 0)

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Pagos y Honorarios</div>
          <div className="topbar-sub">Gestión de pagos del personal</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setTab('assign')}>+ Asignar pago</button>
        </div>
      </div>

      <div className="content">
        {/* Summary */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
          {[
            { label: 'Total pendiente', value: totalPending > 0 ? fmtCLP(totalPending) : '$0 CLP', accent: totalPending > 0 ? 'accent-amber' : 'accent-green', icon: '⏳', ibg: totalPending > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: totalPending > 0 ? 'var(--amber)' : 'var(--emerald-d)', delta: 'CLP por pagar' },
            { label: 'Total pagado', value: fmtCLP(totalPaid), accent: 'accent-green', icon: '✅', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)', delta: 'CLP histórico' },
            { label: 'Profesionales activos', value: workers.length, accent: 'accent-blue', icon: '👥', ibg: 'var(--navy-200)', icl: 'var(--navy-700)', delta: 'Con pagos asignados' },
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

        <div className="tabs">
          {[['payments','Todos los pagos'],['assign','Asignar nuevo pago'],['by_worker','Por profesional']].map(([v, l]) => (
            <div key={v} className={`tab ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</div>
          ))}
        </div>

        {/* ── PAYMENTS LIST ── */}
        {tab === 'payments' && (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Profesional</th><th>Período</th><th>Monto</th><th>Estado</th><th>Descripción</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
                  ) : payments.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">💰</div>
                        <div className="empty-state-title">Sin pagos asignados</div>
                        <div className="empty-state-sub">Crea el primer pago con "+ Asignar pago"</div>
                      </div>
                    </td></tr>
                  ) : payments.map(p => {
                    const s = STATUS_MAP[p.status] || STATUS_MAP.pending
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.profiles?.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{p.profiles?.project}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{MONTHS[p.period_month]} {p.period_year}</td>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-1)', fontSize: 14 }}>
                          ${p.amount.toLocaleString('es-CL')} CLP
                        </td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 160 }}>{p.description || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {p.status === 'pending' && (
                              <button className="btn btn-xs btn-primary" onClick={() => updateStatus(p.id, 'in_process')}>🔄 Procesar</button>
                            )}
                            {p.status === 'in_process' && (
                              <button className="btn btn-xs btn-success" onClick={() => updateStatus(p.id, 'paid')}>✅ Pagar</button>
                            )}
                            {p.status === 'paid' && (
                              <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{p.paid_at?.slice(0,10)}</span>
                            )}
                            <button className="btn btn-xs btn-danger" onClick={() => deletePayment(p.id)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ASSIGN PAYMENT ── */}
        {tab === 'assign' && (
          <div className="card" style={{ maxWidth: 580 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Asignar pago a profesional</div>
            <div className="card-sub" style={{ marginBottom: 20 }}>El monto puede calcularse automáticamente desde los turnos</div>

            {error && (
              <div style={{ background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>⚠ {error}</div>
            )}

            <form onSubmit={handleAssign}>
              <div className="g2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Profesional *</label>
                  <select className="form-input" required value={form.worker_id} onChange={e => { f('worker_id', e.target.value); setError('') }}>
                    <option value="">Seleccionar...</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.full_name} — {w.role_label}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Estado inicial</label>
                  <select className="form-input" value={form.status} onChange={e => f('status', e.target.value)}>
                    <option value="pending">⏳ Pendiente</option>
                    <option value="in_process">🔄 En proceso</option>
                    <option value="paid">✅ Pagado</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Mes del período</label>
                  <select className="form-input" value={form.period_month} onChange={e => f('period_month', e.target.value)}>
                    {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Año</label>
                  <select className="form-input" value={form.period_year} onChange={e => f('period_year', e.target.value)}>
                    {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Monto (CLP) *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number" className="form-input" style={{ flex: 1, marginBottom: 0 }}
                      placeholder="Ej: 420000"
                      value={form.amount} onChange={e => f('amount', e.target.value)}
                    />
                    <button type="button" className="btn btn-sm" style={{ flexShrink: 0 }} onClick={autoCalc} title="Calcular desde turnos completados">
                      🧮 Auto
                    </button>
                  </div>
                  {form.worker_id && (
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                      Turnos de {MONTHS[form.period_month]}: <strong style={{ color: 'var(--emerald)' }}>
                        ${getWorkerEarnings(form.worker_id, Number(form.period_month), Number(form.period_year)).toLocaleString('es-CL')} CLP
                      </strong> — presiona 🧮 Auto para usar este valor
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Descripción (opcional)</label>
                  <input className="form-input" placeholder="Ej: Honorarios mes mayo..." value={form.description} onChange={e => f('description', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? 'Guardando...' : '💾 Asignar pago'}
                </button>
                <button type="button" className="btn" onClick={() => setTab('payments')}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* ── BY WORKER ── */}
        {tab === 'by_worker' && (
          <div>
            {workers.map((w, i) => {
              const wPayments = payments.filter(p => p.worker_id === w.id)
              const totalW    = wPayments.filter(p => p.status !== 'paid').reduce((a, p) => a + (p.amount || 0), 0)
              const monthEarn = getWorkerEarnings(w.id, now.getMonth() + 1, now.getFullYear())
              const COLORS    = [{ bg: '#dbeafe', col: '#1e3a8a' }, { bg: '#d1fae5', col: '#065f46' }, { bg: '#fef9c3', col: '#92400e' }, { bg: '#ede9fe', col: '#4c1d95' }, { bg: '#cffafe', col: '#0e7490' }, { bg: '#fce7f3', col: '#9d174d' }]
              const c         = COLORS[i % COLORS.length]
              const ini       = (w.full_name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={w.id} className="card" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)', flexShrink: 0 }}>{ini}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{w.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{w.role_label} · {w.project || 'Sin proyecto'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {monthEarn > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>Ganado este mes</div>
                      )}
                      {monthEarn > 0 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: 'var(--emerald)' }}>
                          ${monthEarn.toLocaleString('es-CL')}
                        </div>
                      )}
                      {totalW > 0 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--amber)', marginTop: 2 }}>
                          Pendiente: ${totalW.toLocaleString('es-CL')}
                        </div>
                      )}
                    </div>
                  </div>
                  {wPayments.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-4)', textAlign: 'center', padding: '10px 0' }}>Sin pagos asignados</div>
                  ) : wPayments.slice(0, 3).map(p => {
                    const s = STATUS_MAP[p.status] || STATUS_MAP.pending
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{MONTHS[p.period_month]} {p.period_year}</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>${p.amount.toLocaleString('es-CL')} CLP</span>
                          <span className={`badge ${s.cls}`} style={{ fontSize: 10 }}>{s.label}</span>
                          {p.status === 'pending' && <button className="btn btn-xs btn-primary" onClick={() => updateStatus(p.id, 'in_process')}>🔄</button>}
                          {p.status === 'in_process' && <button className="btn btn-xs btn-success" onClick={() => updateStatus(p.id, 'paid')}>✅</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
