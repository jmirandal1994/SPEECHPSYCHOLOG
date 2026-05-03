import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => { loadData() }, [filter])

  async function loadData() {
    let q = supabase.from('requests').select('*, profiles(full_name, role_label, project)').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setRequests(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('requests').update({ status }).eq('id', id)
    loadData()
  }

  const MOCK = [
    { id:1, type:'inasistencia', status:'pending', profiles:{full_name:'M. González', role_label:'Enfermera', project:'CardioHome Sur'}, description:'Inasistencia mañana por consulta médica', created_at:'2025-05-15' },
    { id:2, type:'reclamo', status:'pending', profiles:{full_name:'C. Ramírez', role_label:'TENS', project:'Speech Norte'}, description:'Error en registro de turno del 12 mayo', created_at:'2025-05-14' },
    { id:3, type:'cambio', status:'pending', profiles:{full_name:'L. Pérez', role_label:'Auxiliar', project:'CardioHome Norte'}, description:'Cambio turno 18 mayo por compromiso familiar', created_at:'2025-05-13' },
    { id:4, type:'inasistencia', status:'approved', profiles:{full_name:'J. Vargas', role_label:'TENS', project:'CardioHome Sur'}, description:'Inasistencia aprobada 10 mayo', created_at:'2025-05-09' },
  ]

  const rows = requests.length ? requests : MOCK.filter(r => filter === 'all' || r.status === filter)

  const TYPE_ICON = { inasistencia:'📋', reclamo:'⚠', cambio:'🔄' }
  const TYPE_LABEL = { inasistencia:'Inasistencia', reclamo:'Reclamo', cambio:'Cambio de turno' }
  const STATUS_BADGE = {
    pending:  { cls:'badge-amber', label:'Pendiente' },
    approved: { cls:'badge-green', label:'Aprobada' },
    rejected: { cls:'badge-red',   label:'Rechazada' },
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Solicitudes</div>
          <div className="topbar-sub">Gestión de solicitudes del personal</div>
        </div>
      </div>

      <div className="content">
        <div className="tabs">
          {[['pending','Pendientes'],['approved','Aprobadas'],['rejected','Rechazadas'],['all','Todas']].map(([v,l]) => (
            <div key={v} className={`tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Profesional</th><th>Descripción</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const b = STATUS_BADGE[r.status] || STATUS_BADGE.pending
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:16}}>{TYPE_ICON[r.type]}</span>
                          <span style={{fontWeight:600,fontSize:13}}>{TYPE_LABEL[r.type]}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{fontWeight:600}}>{r.profiles?.full_name}</div>
                        <div style={{fontSize:11,color:'var(--text-4)'}}>{r.profiles?.project}</div>
                      </td>
                      <td style={{fontSize:12,color:'var(--text-3)',maxWidth:220}}>{r.description}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{r.created_at?.slice(0,10)}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td>
                        {r.status === 'pending' && (
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-success btn-xs" onClick={() => updateStatus(r.id,'approved')}>✓ Aprobar</button>
                            <button className="btn btn-danger btn-xs" onClick={() => updateStatus(r.id,'rejected')}>✗ Rechazar</button>
                          </div>
                        )}
                        {r.status !== 'pending' && <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
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
