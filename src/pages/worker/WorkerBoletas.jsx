import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function WorkerBoletas() {
  const { user } = useAuth()
  const [boletas, setBoletas]   = useState([])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess]   = useState(false)

  useEffect(() => {
    if (user) supabase.from('boletas').select('*').eq('worker_id', user.id).order('period_year', { ascending: false })
      .then(({ data }) => setBoletas(data || []))
  }, [user])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const now = new Date()
    const path = `boletas/${user?.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('boletas').upload(path, file)
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('boletas').getPublicUrl(path)
      await supabase.from('boletas').insert([{
        worker_id: user?.id,
        period_month: now.getMonth() + 1,
        period_year: now.getFullYear(),
        amount: 420000, // worker fills this; can add a field
        file_url: publicUrl,
        status: 'submitted',
        submitted_at: now.toISOString(),
      }])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    }
    setUploading(false)
  }

  const MOCK_HIST = [
    { id:1, period_month:4, period_year:2025, amount:504000, status:'paid', submitted_at:'2025-04-30', file_url:'#' },
    { id:2, period_month:3, period_year:2025, amount:448000, status:'paid', submitted_at:'2025-03-31', file_url:'#' },
    { id:3, period_month:2, period_year:2025, amount:392000, status:'paid', submitted_at:'2025-02-28', file_url:'#' },
  ]

  const STATUS = { paid:'badge-green', submitted:'badge-blue', pending:'badge-amber', rejected:'badge-red' }
  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
            <span className="alert-icon">✓</span>
            <div className="alert-body">
              <div className="alert-title">Boleta enviada correctamente</div>
              <div className="alert-msg">La administración procesará el pago a la brevedad.</div>
            </div>
          </div>
        )}

        {/* Current month upload */}
        <div className="card" style={{marginBottom:16}}>
          <div className="card-title" style={{marginBottom:4}}>Enviar boleta del mes</div>
          <div className="card-sub" style={{marginBottom:16}}>Mayo 2025 &nbsp;·&nbsp; 15 turnos completados &nbsp;·&nbsp; Total: $420.000 CLP</div>
          <label className="upload-area" style={{cursor:'pointer',display:'block'}}>
            <div style={{fontSize:36,marginBottom:10}}>📄</div>
            <div style={{fontSize:14,color:'var(--accent)',fontWeight:700,marginBottom:4}}>
              {uploading ? 'Subiendo boleta...' : 'Arrastra tu boleta aquí o haz clic para subir'}
            </div>
            <div style={{fontSize:12,color:'var(--text-4)'}}>PDF, JPG o PNG &nbsp;·&nbsp; Máx. 10 MB</div>
            <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} />
          </label>
          <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:14}} onClick={() => document.querySelector('input[type=file]').click()} disabled={uploading}>
            📤 Enviar boleta ($420.000)
          </button>
        </div>

        {/* History */}
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>Historial de boletas</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Período</th><th>Turnos</th><th>Monto</th><th>Enviada</th><th>Estado pago</th><th>Documento</th></tr>
              </thead>
              <tbody>
                {(boletas.length ? boletas : MOCK_HIST).map(b => (
                  <tr key={b.id}>
                    <td style={{fontWeight:700}}>{MONTHS[b.period_month]} {b.period_year}</td>
                    <td style={{color:'var(--text-4)'}}>—</td>
                    <td style={{fontWeight:800,fontFamily:'var(--font-mono)'}}>${(b.amount||0).toLocaleString('es-CL')}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{b.submitted_at?.slice(0,10) || '—'}</td>
                    <td><span className={`badge ${STATUS[b.status]||'badge-gray'}`}>{b.status === 'paid' ? 'Pagado ✓' : b.status}</span></td>
                    <td>
                      {b.file_url && <a href={b.file_url} target="_blank" rel="noreferrer" className="btn btn-xs">📄 Ver</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
