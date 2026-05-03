import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const TYPE_ICON  = { inasistencia: '📋', reclamo: '⚠', cambio: '🔄' }
const TYPE_LABEL = { inasistencia: 'Inasistencia', reclamo: 'Reclamo', cambio: 'Cambio de turno' }
const STATUS_MAP = {
  pending:  { cls: 'badge-amber', label: 'Pendiente' },
  approved: { cls: 'badge-green', label: 'Aprobada' },
  rejected: { cls: 'badge-red',   label: 'Rechazada' },
}

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending')

  useEffect(() => { loadData() }, [filter])

  async function loadData() {
    setLoading(true)
    let q = supabase
      .from('requests')
      .select('*, profiles(full_name, role_label, project)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setRequests(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    setRequests(r => r.map(x => x.id === id ? { ...x, status } : x))
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
          {[['pending','Pendientes'],['approved','Aprobadas'],['rejected','Rechazadas'],['all','Todas']].map(([v, l]) => (
            <div key={v} className={`tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Profesional</th><th>Descripción</th><th>Fecha afectada</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-title">Sin solicitudes {filter !== 'all' ? `"${filter}"` : ''}</div>
                      <div className="empty-state-sub">Las solicitudes del personal aparecerán aquí</div>
                    </div>
                  </td></tr>
                ) : requests.map(r => {
                  const b = STATUS_MAP[r.status] || STATUS_MAP.pending
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{TYPE_ICON[r.type] || '📋'}</span>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{TYPE_LABEL[r.type] || r.type}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.profiles?.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{r.profiles?.project}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 240 }}>{r.description || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {r.affected_date || r.created_at?.slice(0, 10) || '—'}
                      </td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-success btn-xs" onClick={() => updateStatus(r.id, 'approved')}>✓ Aprobar</button>
                            <button className="btn btn-danger btn-xs" onClick={() => updateStatus(r.id, 'rejected')}>✗ Rechazar</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>
                        )}
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
