import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const MONTHS  = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const STATUS_MAP = {
  paid:      { cls: 'badge-green', label: 'Pagado ✓' },
  submitted: { cls: 'badge-blue',  label: 'Recibida' },
  pending:   { cls: 'badge-amber', label: 'Pendiente' },
  rejected:  { cls: 'badge-red',   label: 'Rechazada' },
}

export default function Boletas() {
  const [boletas, setBoletas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  useEffect(() => { loadData() }, [filter])

  async function loadData() {
    setLoading(true)
    let q = supabase
      .from('boletas')
      .select('*, profiles(full_name, role_label, project)')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setBoletas(data || [])
    setLoading(false)
  }

  async function markPaid(id) {
    await supabase.from('boletas').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    setBoletas(b => b.map(x => x.id === id ? { ...x, status: 'paid', paid_at: new Date().toISOString() } : x))
  }

  const totalSubmitted = boletas.filter(b => b.status === 'submitted').reduce((s, b) => s + (b.amount || 0), 0)

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Boletas de Honorarios</div>
          <div className="topbar-sub">Control y pago de honorarios del personal</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm">📥 Exportar</button>
        </div>
      </div>

      <div className="content">
        {totalSubmitted > 0 && (
          <div className="alert alert-info">
            <span className="alert-icon">💰</span>
            <div className="alert-body">
              <div className="alert-title">Boletas pendientes de pago</div>
              <div className="alert-msg">
                Total a pagar: <strong>${totalSubmitted.toLocaleString('es-CL')} CLP</strong>
              </div>
            </div>
          </div>
        )}

        <div className="tabs">
          {[['all','Todas'],['submitted','Recibidas'],['paid','Pagadas'],['pending','Pendientes']].map(([v,l]) => (
            <div key={v} className={`tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Profesional</th><th>Período</th><th>Monto</th><th>Estado</th><th>Enviada</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
                ) : boletas.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">💰</div>
                      <div className="empty-state-title">Sin boletas registradas</div>
                      <div className="empty-state-sub">Las boletas aparecerán aquí cuando los profesionales las envíen desde su panel</div>
                    </div>
                  </td></tr>
                ) : boletas.map(b => {
                  const s = STATUS_MAP[b.status] || STATUS_MAP.pending
                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.profiles?.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{b.profiles?.role_label} · {b.profiles?.project}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{MONTHS[b.period_month]} {b.period_year}</td>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>
                        ${(b.amount || 0).toLocaleString('es-CL')}
                      </td>
                      <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {b.submitted_at?.slice(0, 10) || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {b.file_url && (
                            <a href={b.file_url} target="_blank" rel="noreferrer" className="btn btn-xs">📄 Ver</a>
                          )}
                          {b.status === 'submitted' && (
                            <button className="btn btn-success btn-xs" onClick={() => markPaid(b.id)}>✓ Pagar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
