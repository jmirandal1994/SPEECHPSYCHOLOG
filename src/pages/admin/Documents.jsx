import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Documents() {
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter]     = useState('all')

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    const { data } = await supabase
      .from('documents')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const path = `docs/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      await supabase.from('documents').insert([{
        name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        size_bytes: file.size,
        category: 'general',
      }])
      loadDocs()
    }
    setUploading(false)
  }

  const MOCK_DOCS = [
    { id:1, name:'Contrato_María_González.pdf', category:'contratos', created_at:'2025-05-10', profiles:{full_name:'María González'}, file_type:'application/pdf', size_bytes:245000 },
    { id:2, name:'Protocolo_CardioHome_v3.pdf', category:'protocolos', created_at:'2025-05-08', profiles:{full_name:'Admin'}, file_type:'application/pdf', size_bytes:890000 },
    { id:3, name:'Licitación_CESFAM_Norte.pdf', category:'licitaciones', created_at:'2025-05-01', profiles:{full_name:'Admin'}, file_type:'application/pdf', size_bytes:1240000 },
    { id:4, name:'Registro_turnos_abril.xlsx', category:'turnos', created_at:'2025-04-30', profiles:{full_name:'Admin'}, file_type:'application/xlsx', size_bytes:340000 },
    { id:5, name:'Boleta_honorarios_RS_abr.pdf', category:'boletas', created_at:'2025-04-30', profiles:{full_name:'Roberto Salinas'}, file_type:'application/pdf', size_bytes:180000 },
  ]

  const CATS = ['all','contratos','licitaciones','protocolos','boletas','turnos']
  const rows = (docs.length ? docs : MOCK_DOCS).filter(d => filter === 'all' || d.category === filter)

  function fmtSize(bytes) {
    if (bytes > 1000000) return `${(bytes/1000000).toFixed(1)} MB`
    return `${(bytes/1000).toFixed(0)} KB`
  }

  const CAT_BADGE = {
    contratos: 'badge-blue', licitaciones: 'badge-teal', protocolos: 'badge-gray',
    boletas: 'badge-green', turnos: 'badge-amber', general: 'badge-gray',
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Documentos</div>
          <div className="topbar-sub">Repositorio central de documentos</div>
        </div>
        <div className="topbar-right">
          <label className="btn btn-primary btn-sm" style={{ cursor:'pointer' }}>
            {uploading ? 'Subiendo...' : '⬆ Subir documento'}
            <input type="file" style={{ display:'none' }} onChange={handleUpload} accept=".pdf,.doc,.docx,.xlsx,.jpg,.png" />
          </label>
        </div>
      </div>

      <div className="content">
        {/* Upload area */}
        <div className="upload-area" style={{ marginBottom: 16 }} onClick={() => document.querySelector('#doc-upload').click()}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
          <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
            Arrastra documentos aquí o haz clic para subir
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-4)' }}>PDF, Word, Excel, imágenes · Máx. 20 MB</div>
          <input id="doc-upload" type="file" style={{ display:'none' }} onChange={handleUpload} />
        </div>

        {/* Filter tabs */}
        <div className="tabs">
          {CATS.map(c => (
            <div key={c} className={`tab ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
              {c === 'all' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Categoría</th><th>Subido por</th><th>Tamaño</th><th>Fecha</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:32}}><div className="spinner"/></td></tr>
                ) : rows.map(d => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{d.file_type?.includes('pdf') ? '📄' : d.file_type?.includes('xl') ? '📊' : '📎'}</span>
                        <span style={{ fontWeight:600, color:'var(--text-1)', fontSize:13 }}>{d.name}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${CAT_BADGE[d.category] || 'badge-gray'}`}>{d.category}</span></td>
                    <td style={{ fontSize:12 }}>{d.profiles?.full_name || '—'}</td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{fmtSize(d.size_bytes)}</td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{d.created_at?.slice(0,10)}</td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="btn btn-xs">⬇ Descargar</a>}
                        <button className="btn btn-xs">✕</button>
                      </div>
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
