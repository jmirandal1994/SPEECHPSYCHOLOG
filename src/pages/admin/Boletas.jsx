import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Boletas() {
  const [boletas, setBoletas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase
      .from('boletas')
      .select('*, profiles(full_name, role_label, project)')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
    setBoletas(data || [])
    setLoading(false)
  }

  async function markPaid(id) {
    await supabase.from('boletas').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    loadData()
  }

  const MOCK = [
    { id:1, profiles:{full_name:'María González', role_label:'Enfermera', project:'CardioHome Sur'}, period_month:5, period_year:2025, amount:420000, status:'submitted', submitted_at:'2025-05-15', file_url:'#' },
    { id:2, profiles:{full_name:'Carlos Ramírez', role_label:'TENS', project:'Speech Norte'}, period_month:5, period_year:2025, amount:390000, status:'pending', submitted_at:null },
    { id:3, profiles:{full_name:'Roberto Salinas', role_label:'TENS', project:'CardioHome Sur'}, period_month:4, period_year:2025, amount:504000, status:'paid', paid_at:'2025-04-30', file_url:'#' },
    { id:4, profiles:{full_name:'Lucía Pérez', role_label:'Auxiliar', project:'CardioHome Norte'}, period_month:4, period_year:2025, amount:280000, status:'paid', paid_at:'2025-04-30', file_url:'#' },
    { id:5, profiles:{full_name:'Ana Pinto', role_label:'Enfermera', project:'CardioHome Sur'}, period_month:5, period_year:2025, amount:448000, status:'submitted', submitted_at:'2025-05-14', file_url:'#' },
  ]

  const rows = boletas.length ? boletas : MOCK
  const STATUS = {
    paid:      { cls:'badge-green', label:'Pagado' },
    submitted: { cls:'badge-blue',  label:'Recibida' },
    pending:   { cls:'badge-amber', label:'Pendiente' },
    rejected:  { cls:'badge-red',   label:'Rechazada' },
  }

  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const totalPending = rows.filter(b => b.status === 'submitted').reduce((s,b) => s + (b.amount||0), 0)

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
        {totalPending > 0 && (
          <div className="alert alert-info">
            <span className="alert-icon">💰</span>
            <div className="alert-body">
              <div className="alert-title">Boletas pendientes de pago</div>
              <div className="alert-msg">
                Hay boletas recibidas por un total de <strong>${totalPending.toLocaleString('es-CL')} CLP</strong> pendientes de pago.
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Profesional</th><th>Período</th><th>Monto</th><th>Estado</th><th>Enviada</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {rows.map(b => {
                  const s = STATUS[b.status] || STATUS.pending
                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{fontWeight:600}}>{b.profiles?.full_name}</div>
                        <div style={{fontSize:11,color:'var(--text-4)'}}>{b.profiles?.role_label} · {b.profiles?.project}</div>
                      </td>
                      <td style={{fontWeight:600}}>{MONTHS[b.period_month]} {b.period_year}</td>
                      <td style={{fontWeight:800,fontFamily:'var(--font-mono)',color:'var(--text-1)'}}>
                        ${(b.amount||0).toLocaleString('es-CL')}
                      </td>
                      <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{b.submitted_at?.slice(0,10) || '—'}</td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          {b.file_url && <a href={b.file_url} target="_blank" rel="noreferrer" className="btn btn-xs">📄 Ver</a>}
                          {b.status === 'submitted' && (
                            <button className="btn btn-success btn-xs" onClick={() => markPaid(b.id)}>✓ Marcar pagado</button>
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
