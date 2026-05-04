import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const TYPE_ICON  = { inasistencia: '📋', reclamo: '⚠', cambio: '🔄' }
const TYPE_LABEL = { inasistencia: 'Inasistencia', reclamo: 'Reclamo', cambio: 'Cambio de turno' }
const STATUS_CLS = { pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-red' }
const STATUS_LBL = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }

export default function WorkerRequests() {
  const { user }  = useAuth()
  const [type,    setType]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [date,    setDate]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadHistory()
  }, [user])

  async function loadHistory() {
    setLoading(true)
    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false })
    // No mock data — only real requests
    setHistory(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('requests').insert([{
      worker_id:     user.id,
      type,
      description:   desc,
      affected_date: date || null,
      status:        'pending',
    }])
    if (!error) {
      setSuccess(true)
      setType(''); setDesc(''); setDate('')
      loadHistory()
      setTimeout(() => setSuccess(false), 4000)
    }
    setSaving(false)
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mis Solicitudes</div>
          <div className="topbar-sub">Comunicación con administración</div>
        </div>
      </div>

      <div className="content">
        {success && (
          <div className="alert alert-success" style={{ marginBottom: 14 }}>
            <span className="alert-icon">✅</span>
            <div className="alert-body">
              <div className="alert-title">Solicitud enviada</div>
              <div className="alert-msg">La administración la revisará a la brevedad.</div>
            </div>
          </div>
        )}

        <div className="g2">
          {/* New request form */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Nueva solicitud</div>
            <div className="card-sub" style={{ marginBottom: 18 }}>Selecciona el tipo y completa el formulario</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Tipo *</label>
                <select className="form-input" required value={type} onChange={e => setType(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="inasistencia">📋 Inasistencia</option>
                  <option value="reclamo">⚠ Reclamo</option>
                  <option value="cambio">🔄 Cambio de turno</option>
                </select>
              </div>
              {type && (
                <>
                  <div className="form-group">
                    <label className="form-label">Fecha afectada</label>
                    <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  {type === 'inasistencia' && (
                    <div className="alert alert-warn" style={{ marginBottom: 14 }}>
                      <span className="alert-icon">⚠</span>
                      <div className="alert-body">
                        <div className="alert-msg">Mínimo <strong>24 horas</strong> de anticipación requeridas.</div>
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Descripción *</label>
                    <textarea
                      className="form-input" required rows={4}
                      value={desc} onChange={e => setDesc(e.target.value)}
                      placeholder="Describe el motivo..."
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={saving}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {saving ? 'Enviando...' : '📤 Enviar solicitud'}
                  </button>
                </>
              )}
            </form>
          </div>

          {/* History — real only */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Historial de solicitudes</div>
            {loading ? (
              <div className="empty-state" style={{ padding: '24px 0' }}><div className="spinner" /></div>
            ) : history.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">Sin solicitudes enviadas</div>
                <div className="empty-state-sub">Tus solicitudes aparecerán aquí</div>
              </div>
            ) : history.map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{TYPE_ICON[r.type] || '📋'}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{TYPE_LABEL[r.type] || r.type}</span>
                  </div>
                  <span className={`badge ${STATUS_CLS[r.status] || 'badge-gray'}`}>
                    {STATUS_LBL[r.status] || r.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 3 }}>{r.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                  {r.created_at?.slice(0, 10)}
                  {r.affected_date ? ` · Fecha: ${r.affected_date}` : ''}
                </div>
                {r.status === 'rejected' && r.admin_notes && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#991b1b', background: 'var(--red-l)', borderRadius: 6, padding: '6px 10px' }}>
                    Motivo: {r.admin_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
