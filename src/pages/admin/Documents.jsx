import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const CATS = ['general','contratos','licitaciones','protocolos','boletas','turnos']
const CAT_BADGE = { contratos:'badge-blue', licitaciones:'badge-teal', protocolos:'badge-gray', boletas:'badge-green', turnos:'badge-amber', general:'badge-gray' }

export default function Documents() {
  const [docs,      setDocs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filter,    setFilter]    = useState('all')
  const [cat,       setCat]       = useState('general')

  useEffect(() => { loadDocs() }, [filter])

  async function loadDocs() {
    setLoading(true)
    let q = supabase.from('documents').select('*, profiles(full_name)').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('category', filter)
    const { data } = await q
    setDocs(data || [])
    setLoading(false)
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const path = `docs/${Date.now()}_${file.name.replace(/\s/g,'_')}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      await supabase.from('documents').insert([{
        name: file.name, file_url: publicUrl,
        file_type: file.type, size_bytes: file.size, category: cat,
      }])
      loadDocs()
    } else {
      alert('Error al subir: ' + upErr.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function deleteDoc(id) {
    if (!confirm('¿Eliminar este documento?')) return
    await supabase.from('documents').delete().eq('id', id)
    setDocs(d => d.filter(x => x.id !== id))
  }

  function fmtSize(bytes) {
    if (!bytes) return '—'
    return bytes > 1000000 ? `${(bytes/1000000).toFixed(1)} MB` : `${(bytes/1000).toFixed(0)} KB`
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Documentos</div>
          <div className="topbar-sub">Repositorio central · {docs.length} archivos</div>
        </div>
        <div className="topbar-right">
          <select className="form-input" style={{marginBottom:0,fontSize:12,padding:'6px 10px',width:150}} value={cat} onChange={e=>setCat(e.target.value)}>
            {CATS.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </select>
          <label className="btn btn-primary btn-sm" style={{cursor:'pointer'}}>
            {uploading?'⬆ Subiendo...':'⬆ Subir documento'}
            <input type="file" style={{display:'none'}} onChange={handleUpload} accept=".pdf,.doc,.docx,.xlsx,.jpg,.png" disabled={uploading}/>
          </label>
        </div>
      </div>

      <div className="content">
        <label className="upload-area" style={{marginBottom:16,cursor:'pointer',display:'block'}}>
          <div style={{fontSize:36,marginBottom:8}}>📁</div>
          <div style={{fontSize:14,color:'var(--accent)',fontWeight:700,marginBottom:4}}>
            {uploading?'Subiendo...':'Arrastra documentos aquí o haz clic para subir'}
          </div>
          <div style={{fontSize:12,color:'var(--text-4)'}}>PDF, Word, Excel, imágenes · Categoría: <strong>{cat}</strong></div>
          <input type="file" style={{display:'none'}} onChange={handleUpload} accept=".pdf,.doc,.docx,.xlsx,.jpg,.png" disabled={uploading}/>
        </label>

        <div className="tabs">
          {[['all','Todos'],...CATS.map(c=>[c,c.charAt(0).toUpperCase()+c.slice(1)])].map(([v,l])=>(
            <div key={v} className={`tab ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{l}</div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Categoría</th><th>Tamaño</th><th>Fecha</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{textAlign:'center',padding:40}}><div className="spinner"/></td></tr>
                ) : docs.length === 0 ? (
                  <tr><td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📁</div>
                      <div className="empty-state-title">Sin documentos</div>
                      <div className="empty-state-sub">Sube el primer documento arriba</div>
                    </div>
                  </td></tr>
                ) : docs.map(d=>(
                  <tr key={d.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:18}}>{d.file_type?.includes('pdf')?'📄':d.file_type?.includes('xl')?'📊':d.file_type?.includes('image')?'🖼':'📎'}</span>
                        <span style={{fontWeight:600,fontSize:12,color:'var(--text-1)'}}>{d.name}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${CAT_BADGE[d.category]||'badge-gray'}`}>{d.category}</span></td>
                    <td style={{fontSize:12,fontFamily:'var(--font-mono)'}}>{fmtSize(d.size_bytes)}</td>
                    <td style={{fontSize:12,fontFamily:'var(--font-mono)'}}>{d.created_at?.slice(0,10)}</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="btn btn-xs">⬇ Ver</a>}
                        <button className="btn btn-danger btn-xs" onClick={()=>deleteDoc(d.id)}>🗑</button>
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
