import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function WorkerRequests() {
  const { user } = useAuth()
  const [type, setType]       = useState('')
  const [desc, setDesc]       = useState('')
  const [date, setDate]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (user) supabase.from('requests').select('*').eq('worker_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setHistory(data || []))
  }, [user])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('requests').insert([{
      worker_id: user?.id,
      type,
      description: desc,
      affected_date: date || null,
      status: 'pending',
    }])
    setSuccess(true)
    setType(''); setDesc(''); setDate('')
    setSaving(false)
    setTimeout(() => setSuccess(false), 4000)
  }

  const STATUS = { pending:'badge-amber', approved:'badge-green', rejected:'badge-red' }
  const TYPE_L = { inasistencia:'Inasistencia', reclamo:'Reclamo', cambio:'Cambio de turno' }

  const MOCK_HIST = [
    { id:1, type:'inasistencia', description:'Consulta médica', affected_date:'2025-05-10', status:'approved', created_at:'2025-05-09' },
    { id:2, type:'reclamo', description:'Error en registro de entrada', affected_date:'2025-04-22', status:'pending', created_at:'2025-04-22' },
  ]

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Solicitudes</div>
          <div className="topbar-sub">Comunicación con administración</div>
        </div>
      </div>
      <div className="content">
        <div className="g2">
          <div>
            {success && (
              <div className="alert alert-success" style={{marginBottom:14}}>
                <span className="alert-icon">✓</span>
                <div className="alert-body">
                  <div className="alert-title">Solicitud enviada correctamente</div>
                  <div className="alert-msg">La administración revisará tu solicitud a la brevedad.</div>
                </div>
              </div>
            )}
            <div className="card">
              <div className="card-title" style={{marginBottom:4}}>Nueva solicitud</div>
              <div className="card-sub" style={{marginBottom:18}}>Selecciona el tipo y completa el formulario</div>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Tipo de solicitud *</label>
                  <select className="form-input" required value={type} onChange={e => setType(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    <option value="inasistencia">Solicitud de inasistencia</option>
                    <option value="reclamo">Reclamo</option>
                    <option value="cambio">Cambio de turno</option>
                  </select>
                </div>
                {type && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Fecha afectada</label>
                      <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    {type === 'inasistencia' && (
                      <div className="alert alert-warn">
                        <span className="alert-icon">⚠</span>
                        <div className="alert-body">
                          <div className="alert-msg">Mínimo <strong>24 horas</strong> de anticipación requeridas.</div>
                        </div>
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Descripción *</label>
                      <textarea className="form-input" required rows={4} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe el motivo de tu solicitud..." />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={saving} style={{width:'100%',justifyContent:'center'}}>
                      {saving ? 'Enviando...' : '📤 Enviar solicitud'}
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{marginBottom:14}}>Historial de solicitudes</div>
            {(history.length ? history : MOCK_HIST).map(r => (
              <div key={r.id} style={{padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontWeight:600,fontSize:13}}>{TYPE_L[r.type]}</span>
                  <span className={`badge ${STATUS[r.status]||'badge-gray'}`}>{r.status}</span>
                </div>
                <div style={{fontSize:12,color:'var(--text-3)'}}>{r.description}</div>
                <div style={{fontSize:11,color:'var(--text-4)',marginTop:4,fontFamily:'var(--font-mono)'}}>{r.created_at?.slice(0,10)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
