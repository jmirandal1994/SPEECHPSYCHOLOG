import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const MONTHS   = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const STATUS_MAP = {
  paid:      { cls: 'badge-green', label: 'Pagado ✓' },
  submitted: { cls: 'badge-blue',  label: 'Recibida — en revisión' },
  pending:   { cls: 'badge-amber', label: 'Pendiente de envío' },
  rejected:  { cls: 'badge-red',   label: 'Rechazada' },
}

export default function WorkerBoletas() {
  const { user } = useAuth()
  const [boletas, setBoletas]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [amount, setAmount]       = useState('')
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    const { data } = await supabase
      .from('boletas')
      .select('*')
      .eq('worker_id', user.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
    setBoletas(data || [])
    setLoading(false)
  }

  const alreadySent = boletas.some(b => b.period_month === currentMonth && b.period_year === currentYear)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!amount || isNaN(Number(amount))) { setError('Ingresa el monto de la boleta primero'); return }
    setUploading(true)
    setError('')

    const path = `boletas/${user.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('boletas').upload(path, file)
    if (upErr) { setError('Error al subir el archivo. Intenta de nuevo.'); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('boletas').getPublicUrl(path)
    await supabase.from('boletas').insert([{
      worker_id:     user.id,
      period_month:  currentMonth,
      period_year:   currentYear,
      amount:        Number(amount),
      file_url:      publicUrl,
      status:        'submitted',
      submitted_at:  new Date().toISOString(),
    }])

    setSuccess(true)
    setAmount('')
    loadData()
    setUploading(false)
    setTimeout(() => setSuccess(false), 5000)
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mis Boletas</div>
          <div className="topbar-sub">Gestión de honorarios</div>
        </div>
      </div>

      <div className="content">
        {success && (
          <div className="alert alert-success">
            <span className="alert-icon">✅</span>
            <div className="alert-body">
              <div className="alert-title">Boleta enviada correctamente</div>
              <div className="alert-msg">La administración procesará el pago a la brevedad.</div>
            </div>
          </div>
        )}

        {/* Send current month */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            Enviar boleta — {MONTHS[currentMonth]} {currentYear}
          </div>

          {alreadySent ? (
            <div className="alert alert-success" style={{ marginBottom: 0, marginTop: 12 }}>
              <span className="alert-icon">✓</span>
              <div className="alert-body">
                <div className="alert-msg">Ya enviaste tu boleta de {MONTHS[currentMonth]}. Puedes ver su estado abajo.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="card-sub" style={{ marginBottom: 16 }}>Ingresa el monto y sube tu boleta en PDF o imagen</div>
              {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
              <div className="form-group">
                <label className="form-label">Monto de la boleta (CLP) *</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="Ej: 420000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
              <label className="upload-area" style={{ cursor: 'pointer', display: 'block', marginBottom: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
                  {uploading ? 'Subiendo boleta...' : 'Haz clic para adjuntar tu boleta'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>PDF, JPG o PNG · Máx. 10 MB</div>
                <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={uploading} />
              </label>
            </>
          )}
        </div>

        {/* History */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Historial de boletas</div>
          {loading ? (
            <div className="empty-state" style={{ padding: '24px 0' }}><div className="spinner" /></div>
          ) : boletas.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon">💰</div>
              <div className="empty-state-title">Sin boletas enviadas aún</div>
              <div className="empty-state-sub">Aquí aparecerá el historial de tus boletas</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Período</th><th>Monto</th><th>Estado</th><th>Enviada</th><th>Documento</th></tr>
                </thead>
                <tbody>
                  {boletas.map(b => {
                    const s = STATUS_MAP[b.status] || STATUS_MAP.pending
                    return (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700 }}>{MONTHS[b.period_month]} {b.period_year}</td>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                          ${(b.amount || 0).toLocaleString('es-CL')}
                        </td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {b.submitted_at?.slice(0, 10) || '—'}
                        </td>
                        <td>
                          {b.file_url
                            ? <a href={b.file_url} target="_blank" rel="noreferrer" className="btn btn-xs">📄 Ver</a>
                            : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>Sin archivo</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
