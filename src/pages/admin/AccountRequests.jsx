import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AccountRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending')
  const [processing, setProcessing] = useState({})
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    loadData()

    // Real-time: new request arrives → badge updates instantly
    const channel = supabase
      .channel('account_req_live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'account_requests'
      }, payload => {
        setRequests(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { loadData() }, [filter])

  async function loadData() {
    setLoading(true)
    let q = supabase.from('account_requests').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setRequests(data || [])
    setLoading(false)
  }

  async function approve(req) {
    setProcessing(p => ({ ...p, [req.id]: 'loading' }))

    // 1. Create auth user — email confirmation must be OFF in Supabase Auth settings
    //    Authentication > Providers > Email > "Confirm email" = OFF
    //    This creates the account instantly with no email sent at all
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    req.email,
      password: req.password,
      options: {
        data: { full_name: req.full_name, role: 'worker' },
      }
    })

    if (authErr) {
      alert(`Error: ${authErr.message}`)
      setProcessing(p => ({ ...p, [req.id]: null }))
      return
    }

    // 2. Fill profile with all details
    if (authData?.user?.id) {
      await supabase.from('profiles').upsert({
        id:         authData.user.id,
        email:      req.email,
        full_name:  req.full_name,
        phone:      req.phone,
        rut:        req.rut,
        role:       'worker',
        role_label: req.role_label,
        status:     'active',
      })
    }

    // 3. Mark request approved
    await supabase.from('account_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', req.id)

    setRequests(prev => prev.map(r =>
      r.id === req.id ? { ...r, status: 'approved' } : r
    ))
    setProcessing(p => ({ ...p, [req.id]: 'done' }))
  }

  async function reject(id, reason) {
    await supabase.from('account_requests')
      .update({ status: 'rejected', reject_reason: reason, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', reject_reason: reason } : r))
    setRejectModal(null)
    setRejectReason('')
  }

  const pending = requests.filter(r => r.status === 'pending').length

  const ROLE_COLORS = {
    'Enfermera/o':          { bg: '#dbeafe', col: '#1e3a8a' },
    'TENS':                 { bg: '#d1fae5', col: '#065f46' },
    'Auxiliar de servicio': { bg: '#fef9c3', col: '#92400e' },
    'Administrativo':       { bg: '#ede9fe', col: '#4c1d95' },
  }

  const STATUS_BADGE = {
    pending:  { cls: 'badge-amber', label: '⏳ Pendiente' },
    approved: { cls: 'badge-green', label: '✓ Aprobada'  },
    rejected: { cls: 'badge-red',   label: '✗ Rechazada' },
  }

  return (
    <div className="page-enter">

      {/* Reject modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 28, width: 400, boxShadow: 'var(--sh-lg)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Rechazar solicitud</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
              Rechazar la solicitud de <strong>{rejectModal.name}</strong>. Puedes indicar el motivo.
            </div>
            <textarea
              className="form-input" rows={3}
              placeholder="Motivo del rechazo (opcional)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => { setRejectModal(null); setRejectReason('') }}>Cancelar</button>
              <button className="btn btn-danger btn-sm" onClick={() => reject(rejectModal.id, rejectReason)}>
                ✗ Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Solicitudes de acceso</div>
          <div className="topbar-sub">
            {pending > 0
              ? `${pending} solicitud${pending > 1 ? 'es' : ''} pendiente${pending > 1 ? 's' : ''} de aprobación`
              : 'Gestión de accesos al sistema'}
          </div>
        </div>
      </div>

      <div className="content">

        {/* Share link banner */}
        <div className="alert alert-info" style={{ marginBottom: 18 }}>
          <span className="alert-icon">🔗</span>
          <div className="alert-body">
            <div className="alert-title">Comparte este link con tus profesionales para que se registren</div>
            <div className="alert-msg" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--navy-100)', color: 'var(--navy-700)', padding: '4px 10px', borderRadius: 6 }}>
                {window.location.origin}/register
              </span>
              <button
                className="btn btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/register`)
                  alert('Link copiado ✓')
                }}
              >
                📋 Copiar link
              </button>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="card" style={{ marginBottom: 18, padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
            {[
              { icon: '📋', text: 'Profesional se registra con sus datos y contraseña' },
              { icon: '→',  text: '', arrow: true },
              { icon: '⏳', text: 'Aparece aquí como pendiente' },
              { icon: '→',  text: '', arrow: true },
              { icon: '✅', text: 'Tú apruebas con un click → cuenta activa' },
              { icon: '→',  text: '', arrow: true },
              { icon: '🔑', text: 'El profesional entra con su correo y contraseña' },
            ].map((s, i) => s.arrow ? (
              <span key={i} style={{ fontSize: 18, color: 'var(--text-4)', margin: '0 10px' }}>→</span>
            ) : (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[['pending','Pendientes'],['approved','Aprobadas'],['rejected','Rechazadas'],['all','Todas']].map(([v, l]) => (
            <div key={v} className={`tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>
              {l}
              {v === 'pending' && pending > 0 && (
                <span style={{ marginLeft: 7, background: 'var(--red)', color: '#fff', borderRadius: 20, fontSize: 10, padding: '1px 7px', fontWeight: 700 }}>
                  {pending}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="empty-state-icon">📬</div>
            <div className="empty-state-title">
              {filter === 'pending' ? 'Sin solicitudes pendientes' : 'Sin solicitudes aquí'}
            </div>
            <div className="empty-state-sub">
              Cuando un profesional se registre aparecerá aquí en tiempo real
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(req => {
              const isPending  = req.status === 'pending'
              const isApproved = req.status === 'approved'
              const isDone     = processing[req.id] === 'done'
              const rc = ROLE_COLORS[req.role_label] || { bg: '#f1f5f9', col: '#64748b' }
              const sb = STATUS_BADGE[req.status]
              const ini = (req.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

              return (
                <div
                  key={req.id}
                  className="card"
                  style={{
                    marginBottom: 0,
                    borderColor: isPending ? 'var(--navy-300)' : undefined,
                    boxShadow:   isPending ? 'var(--sh-accent)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                      background: rc.bg, color: rc.col,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)',
                    }}>
                      {ini}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{req.full_name}</span>
                        <span className={`badge ${sb?.cls}`}>{sb?.label}</span>
                        {req.role_label && (
                          <span style={{ background: rc.bg, color: rc.col, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                            {req.role_label}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>📧 {req.email}</span>
                        {req.phone && <span>📱 {req.phone}</span>}
                        {req.rut   && <span style={{ fontFamily: 'var(--font-mono)' }}>🪪 {req.rut}</span>}
                        <span style={{ color: 'var(--text-4)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                          🕐 {new Date(req.created_at).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </div>

                      {req.reject_reason && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#991b1b', background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                          Motivo de rechazo: {req.reject_reason}
                        </div>
                      )}

                      {/* Approved confirmation */}
                      {(isApproved || isDone) && (
                        <div style={{ marginTop: 10, background: 'var(--emerald-l)', border: '1px solid #6ee7b7', borderRadius: 'var(--r)', padding: '10px 14px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald-d)' }}>
                            ✅ Cuenta activada — {req.full_name.split(' ')[0]} ya puede ingresar con su correo y contraseña
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isPending && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                        <button
                          className="btn btn-success"
                          style={{ padding: '10px 20px', fontSize: 13 }}
                          disabled={!!processing[req.id]}
                          onClick={() => approve(req)}
                        >
                          {processing[req.id] === 'loading' ? '⏳ Activando...' : '✓ Aprobar'}
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '10px 20px', fontSize: 13 }}
                          disabled={!!processing[req.id]}
                          onClick={() => setRejectModal({ id: req.id, name: req.full_name })}
                        >
                          ✗ Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
