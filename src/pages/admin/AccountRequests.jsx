import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AccountRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending')
  const [processing, setProcessing] = useState({})
  const [rejectModal, setRejectModal] = useState(null) // { id, name }
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    loadData()

    // Real-time subscription
    const channel = supabase
      .channel('account_requests_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'account_requests' }, payload => {
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
    setProcessing(p => ({ ...p, [req.id]: 'approving' }))

    // 1. Create auth user via signUp
    const tempPassword = `SP${Math.random().toString(36).slice(2, 10).toUpperCase()}!`
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    req.email,
      password: tempPassword,
      options: { data: { full_name: req.full_name, role: 'worker' } }
    })

    if (authErr) {
      alert(`Error al crear cuenta: ${authErr.message}`)
      setProcessing(p => ({ ...p, [req.id]: null }))
      return
    }

    // 2. Enrich profile
    if (authData?.user?.id) {
      await supabase.from('profiles').upsert({
        id:         authData.user.id,
        email:      req.email,
        full_name:  req.full_name,
        phone:      req.phone,
        rut:        req.rut,
        role:       'worker',
        role_label: req.role_label,
        project:    req.project,
        status:     'active',
      })
    }

    // 3. Mark request as approved
    await supabase.from('account_requests').update({
      status:      'approved',
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.id)

    // 4. Update local state & show credentials
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved', _tempPassword: tempPassword } : r))
    setProcessing(p => ({ ...p, [req.id]: 'done', [`${req.id}_pwd`]: tempPassword }))
  }

  async function reject(id, reason) {
    setProcessing(p => ({ ...p, [id]: 'rejecting' }))
    await supabase.from('account_requests').update({
      status:        'rejected',
      reject_reason: reason,
      reviewed_at:   new Date().toISOString(),
    }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', reject_reason: reason } : r))
    setRejectModal(null)
    setRejectReason('')
    setProcessing(p => ({ ...p, [id]: null }))
  }

  const pending = requests.filter(r => r.status === 'pending').length

  const STATUS = {
    pending:  { cls: 'badge-amber', label: '⏳ Pendiente' },
    approved: { cls: 'badge-green', label: '✓ Aprobada' },
    rejected: { cls: 'badge-red',   label: '✗ Rechazada' },
  }

  const ROLE_COLORS = {
    'Enfermera/o':        { bg: '#dbeafe', col: '#1e3a8a' },
    'TENS':               { bg: '#d1fae5', col: '#065f46' },
    'Auxiliar de servicio': { bg: '#fef9c3', col: '#92400e' },
    'Administrativo':     { bg: '#ede9fe', col: '#4c1d95' },
  }

  return (
    <div className="page-enter">
      {/* Reject modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 28, width: 400, boxShadow: 'var(--sh-lg)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Rechazar solicitud</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
              ¿Rechazar la solicitud de <strong>{rejectModal.name}</strong>? Puedes agregar un motivo.
            </div>
            <textarea
              className="form-input"
              rows={3}
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
              ? `${pending} solicitud${pending > 1 ? 'es' : ''} pendiente${pending > 1 ? 's' : ''} de revisión`
              : 'Gestión de accesos al sistema'}
          </div>
        </div>
      </div>

      <div className="content">
        {/* Info banner */}
        <div className="alert alert-info" style={{ marginBottom: 18 }}>
          <span className="alert-icon">ℹ️</span>
          <div className="alert-body">
            <div className="alert-title">Comparte el link de registro con tus profesionales</div>
            <div className="alert-msg">
              URL de registro público:{' '}
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--navy-100)', padding: '2px 8px', borderRadius: 5, cursor: 'pointer', color: 'var(--navy-700)' }}
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/register`)
                  alert('Link copiado ✓')
                }}
              >
                {window.location.origin}/register
              </span>
              {' '}— Haz clic para copiar
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[['pending','Pendientes'],['approved','Aprobadas'],['rejected','Rechazadas'],['all','Todas']].map(([v,l]) => (
            <div key={v} className={`tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>
              {l}
              {v === 'pending' && pending > 0 && (
                <span className="nav-badge" style={{ marginLeft: 8, position: 'static', display: 'inline-block' }}>{pending}</span>
              )}
            </div>
          ))}
        </div>

        {/* Requests list */}
        {loading ? (
          <div className="empty-state" style={{ marginTop: 60 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="empty-state-icon">📬</div>
            <div className="empty-state-title">
              {filter === 'pending' ? 'Sin solicitudes pendientes' : 'Sin solicitudes aquí'}
            </div>
            <div className="empty-state-sub">
              Las solicitudes de tus profesionales aparecerán aquí en tiempo real
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(r => {
              const roleColor = ROLE_COLORS[r.role_label] || { bg: '#f1f5f9', col: '#64748b' }
              const isPending  = r.status === 'pending'
              const isApproved = r.status === 'approved'
              const approvedPwd = processing[`${r.id}_pwd`]
              const s = STATUS[r.status] || STATUS.pending

              return (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    marginBottom: 0,
                    borderColor: isPending ? 'var(--navy-300)' : undefined,
                    boxShadow: isPending ? 'var(--sh-accent)' : undefined,
                    animation: isPending ? undefined : undefined,
                  }}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: roleColor.bg, color: roleColor.col,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-display)',
                    }}>
                      {(r.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{r.full_name}</span>
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                        {r.role_label && (
                          <span style={{ background: roleColor.bg, color: roleColor.col, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                            {r.role_label}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: r.message ? 10 : 0 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>📧 {r.email}</span>
                        {r.phone && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>📱 {r.phone}</span>}
                        {r.rut   && <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>🪪 {r.rut}</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                          🕐 {new Date(r.created_at).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </div>

                      {r.message && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--slate-50)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', marginTop: 8, fontStyle: 'italic' }}>
                          "{r.message}"
                        </div>
                      )}

                      {r.reject_reason && (
                        <div style={{ fontSize: 12, color: '#991b1b', background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r)', padding: '8px 12px', marginTop: 8 }}>
                          Motivo: {r.reject_reason}
                        </div>
                      )}

                      {/* Credentials after approval */}
                      {isApproved && approvedPwd && (
                        <div style={{ marginTop: 12, background: 'var(--emerald-l)', border: '1px solid #6ee7b7', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald-d)', marginBottom: 8 }}>
                            ✅ Cuenta creada — Comparte estas credenciales con {r.full_name.split(' ')[0]}:
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>📧 {r.email}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-1)', background: '#fff', padding: '2px 8px', borderRadius: 5 }}>🔒 {approvedPwd}</span>
                          </div>
                          <button
                            className="btn btn-sm"
                            style={{ marginTop: 10, fontSize: 11 }}
                            onClick={() => {
                              const text = `Hola ${r.full_name.split(' ')[0]}, tu cuenta en Speech Psychology & CardioHome fue aprobada.\n\n📧 Correo: ${r.email}\n🔒 Contraseña temporal: ${approvedPwd}\n🔗 Acceso: ${window.location.origin}\n\nPor favor cambia tu contraseña al ingresar.`
                              navigator.clipboard?.writeText(text)
                              alert('Credenciales copiadas al portapapeles ✓')
                            }}
                          >
                            📋 Copiar credenciales para enviar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isPending && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                        <button
                          className="btn btn-success"
                          style={{ fontSize: 12, padding: '9px 16px' }}
                          disabled={!!processing[r.id]}
                          onClick={() => approve(r)}
                        >
                          {processing[r.id] === 'approving' ? '⏳ Creando...' : '✓ Aprobar'}
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: 12, padding: '9px 16px' }}
                          disabled={!!processing[r.id]}
                          onClick={() => setRejectModal({ id: r.id, name: r.full_name })}
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
