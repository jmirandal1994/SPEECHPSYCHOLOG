import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Default fee rates per role — admin can edit
const DEFAULT_RATES = {
  'Enfermera/o':          35000,
  'TENS':                 28000,
  'Auxiliar de servicio': 22000,
  'Administrativo':       30000,
}

export default function Settings() {
  const [projects,     setProjects]     = useState([])
  const [workers,      setWorkers]      = useState([])
  const [newProject,   setNewProject]   = useState('')
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [editingId,    setEditingId]    = useState(null)
  const [editName,     setEditName]     = useState('')
  const [tableExists,  setTableExists]  = useState(true)

  // Assign project modal
  const [assignModal,  setAssignModal]  = useState(null) // project object
  const [assignWorkers, setAssignWorkers] = useState([]) // selected worker ids

  // Fee rates (stored in localStorage for now, or Supabase settings table)
  const [rates, setRates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sp_rates') || 'null') || DEFAULT_RATES }
    catch { return DEFAULT_RATES }
  })
  const [editingRates, setEditingRates] = useState(false)
  const [rateForm,     setRateForm]     = useState({ ...rates })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    // Load projects
    const { data: p, error: pe } = await supabase.from('projects').select('*').order('name')
    if (pe?.code === '42P01') { setTableExists(false); setLoading(false); return }
    setProjects(p || [])
    setTableExists(true)

    // Load workers
    const { data: w } = await supabase.from('profiles').select('id, full_name, role_label, project').eq('role', 'worker').eq('status', 'active').order('full_name')
    setWorkers(w || [])
    setLoading(false)
  }

  async function addProject(e) {
    e.preventDefault()
    if (!newProject.trim()) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from('projects').insert([{ name: newProject.trim(), active: true }])
    if (err) { setError(err.code === '23505' ? 'Ya existe un proyecto con ese nombre.' : err.message) }
    else { setNewProject(''); loadData() }
    setSaving(false)
  }

  async function saveEdit(id) {
    if (!editName.trim()) return
    const { error: err } = await supabase.from('projects').update({ name: editName.trim() }).eq('id', id)
    if (!err) { setProjects(p => p.map(x => x.id === id ? { ...x, name: editName.trim() } : x)); setEditingId(null) }
  }

  async function toggleProject(id, active) {
    await supabase.from('projects').update({ active: !active }).eq('id', id)
    setProjects(p => p.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  async function deleteProject(id, name) {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(p => p.filter(x => x.id !== id))
  }

  // Open assign modal for a project
  function openAssign(project) {
    setAssignModal(project)
    // Pre-select workers already assigned to this project
    const already = workers.filter(w => w.project === project.name).map(w => w.id)
    setAssignWorkers(already)
  }

  // Toggle worker in selection
  function toggleWorker(id) {
    setAssignWorkers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Save project assignment — updates all selected workers
  async function saveAssignment() {
    setSaving(true)
    const projectName = assignModal.name

    // Workers to assign
    for (const wid of assignWorkers) {
      await supabase.from('profiles').update({ project: projectName }).eq('id', wid)
    }
    // Workers to un-assign (had this project, now not selected)
    const hadProject = workers.filter(w => w.project === projectName).map(w => w.id)
    const toRemove = hadProject.filter(id => !assignWorkers.includes(id))
    for (const wid of toRemove) {
      await supabase.from('profiles').update({ project: '' }).eq('id', wid)
    }

    await loadData()
    setAssignModal(null)
    setSaving(false)
  }

  function saveRates() {
    setRates(rateForm)
    localStorage.setItem('sp_rates', JSON.stringify(rateForm))
    setEditingRates(false)
  }

  // Workers per project count
  function workerCount(projectName) {
    return workers.filter(w => w.project === projectName).length
  }

  const SQL = `CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proj_read" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "proj_write" ON public.projects FOR ALL USING (true);`

  return (
    <div className="page-enter">

      {/* ── ASSIGN PROJECT MODAL ── */}
      {assignModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'var(--surface)',borderRadius:'var(--r-lg)',padding:28,width:'100%',maxWidth:500,maxHeight:'85vh',overflowY:'auto',boxShadow:'var(--sh-lg)' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:'var(--font-display)',fontSize:16,fontWeight:700 }}>Asignar profesionales</div>
                <div style={{ fontSize:12,color:'var(--text-4)',marginTop:3 }}>
                  Proyecto: <strong style={{ color:'var(--accent)' }}>{assignModal.name}</strong>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal(null)}>✕</button>
            </div>

            {workers.length === 0 ? (
              <div className="empty-state" style={{ padding:'24px 0' }}>
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">Sin profesionales registrados</div>
                <div className="empty-state-sub">Ve a Personal y agrega profesionales primero</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom:14,fontSize:12,color:'var(--text-3)' }}>
                  Selecciona los profesionales que pertenecen a este proyecto:
                </div>
                <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap' }}>
                  <button className="btn btn-xs" onClick={() => setAssignWorkers(workers.map(w=>w.id))}>✓ Seleccionar todos</button>
                  <button className="btn btn-xs" onClick={() => setAssignWorkers([])}>✕ Ninguno</button>
                </div>
                {workers.map(w => {
                  const sel = assignWorkers.includes(w.id)
                  return (
                    <div
                      key={w.id}
                      onClick={() => toggleWorker(w.id)}
                      style={{
                        display:'flex',alignItems:'center',gap:12,padding:'11px 14px',
                        borderRadius:'var(--r)',border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`,
                        background:sel?'var(--navy-50)':'var(--surface)',
                        marginBottom:8,cursor:'pointer',transition:'all 0.15s',
                      }}
                    >
                      <div style={{
                        width:22,height:22,borderRadius:6,flexShrink:0,
                        background:sel?'var(--accent)':'var(--slate-200)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        color:'#fff',fontSize:13,transition:'all 0.15s',
                      }}>
                        {sel ? '✓' : ''}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600,fontSize:13,color:'var(--text-1)' }}>{w.full_name}</div>
                        <div style={{ fontSize:11,color:'var(--text-4)',marginTop:2 }}>
                          {w.role_label || '—'}
                          {w.project && w.project !== assignModal.name && (
                            <span style={{ color:'var(--amber)',marginLeft:6 }}>· actualmente en {w.project}</span>
                          )}
                        </div>
                      </div>
                      {/* Show fee for this role */}
                      <div style={{ fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color:'var(--emerald)',flexShrink:0 }}>
                        ${(rates[w.role_label] || 0).toLocaleString('es-CL')}
                      </div>
                    </div>
                  )
                })}
                <div style={{ display:'flex',gap:10,marginTop:20 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex:1,justifyContent:'center' }}
                    onClick={saveAssignment}
                    disabled={saving}
                  >
                    {saving ? 'Guardando...' : `💾 Guardar asignación (${assignWorkers.length} profesionales)`}
                  </button>
                  <button className="btn" onClick={() => setAssignModal(null)}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Configuración</div>
          <div className="topbar-sub">Speech Psychology & CardioHome</div>
        </div>
      </div>

      <div className="content">
        {!tableExists ? (
          <div className="card">
            <div className="alert alert-warn" style={{ marginBottom:14 }}>
              <span className="alert-icon">⚠</span>
              <div className="alert-body">
                <div className="alert-title">Tabla de proyectos no existe aún</div>
                <div className="alert-msg">Ejecuta este SQL en Supabase → SQL Editor:</div>
              </div>
            </div>
            <div style={{ background:'var(--slate-900)',borderRadius:'var(--r)',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:11,color:'#94a3b8',marginBottom:14,whiteSpace:'pre-wrap',overflow:'auto' }}>
              {SQL}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { navigator.clipboard?.writeText(SQL); alert('SQL copiado ✓') }}>📋 Copiar SQL</button>
            <button className="btn btn-sm" style={{ marginLeft:8 }} onClick={loadData}>↻ Verificar</button>
          </div>
        ) : (
          <div>
            {/* ── HONORARIOS POR CARGO ── */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4 }}>
                <div>
                  <div className="card-title">💰 Tarifas por turno según cargo</div>
                  <div className="card-sub">El sistema calculará automáticamente los honorarios al completar turnos</div>
                </div>
                <button className="btn btn-sm" onClick={() => { setEditingRates(v=>!v); setRateForm({...rates}) }}>
                  {editingRates ? '✕ Cancelar' : '✏ Editar tarifas'}
                </button>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginTop:16 }}>
                {Object.entries(editingRates ? rateForm : rates).map(([role, fee]) => (
                  <div key={role} style={{ background:'var(--slate-50)',borderRadius:'var(--r)',padding:'14px 16px',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13,color:'var(--text-1)',marginBottom:2 }}>{role}</div>
                      <div style={{ fontSize:11,color:'var(--text-4)' }}>Por turno completado</div>
                    </div>
                    {editingRates ? (
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ fontSize:12,color:'var(--text-4)' }}>$</span>
                        <input
                          type="number"
                          className="form-input"
                          style={{ marginBottom:0,width:110,fontSize:13,padding:'6px 10px',fontFamily:'var(--font-mono)',fontWeight:700,textAlign:'right' }}
                          value={rateForm[role]||''}
                          onChange={e => setRateForm(prev => ({ ...prev, [role]: Number(e.target.value) }))}
                          min={0}
                        />
                        <span style={{ fontSize:12,color:'var(--text-4)' }}>CLP</span>
                      </div>
                    ) : (
                      <div style={{ fontFamily:'var(--font-mono)',fontWeight:800,fontSize:16,color:'var(--emerald)' }}>
                        ${fee.toLocaleString('es-CL')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {editingRates && (
                <div style={{ marginTop:14,display:'flex',gap:10,alignItems:'center' }}>
                  <button className="btn btn-primary" onClick={saveRates}>💾 Guardar tarifas</button>
                  <div style={{ fontSize:12,color:'var(--text-4)' }}>
                    💡 Estas tarifas se aplicarán automáticamente al crear nuevos turnos
                  </div>
                </div>
              )}
            </div>

            {/* ── PROJECTS ── */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
              <div className="card" style={{ marginBottom:0 }}>
                <div className="card-title" style={{ marginBottom:4 }}>🏥 Proyectos / Licitaciones</div>
                <div className="card-sub" style={{ marginBottom:16 }}>
                  Crea proyectos y asigna profesionales con el botón <strong>Asignar →</strong>
                </div>

                <form onSubmit={addProject} style={{ display:'flex',gap:8,marginBottom:14 }}>
                  <input className="form-input" style={{ flex:1,marginBottom:0 }} placeholder="Nombre del proyecto..." value={newProject} onChange={e=>setNewProject(e.target.value)}/>
                  <button className="btn btn-primary" type="submit" disabled={saving||!newProject.trim()}>
                    {saving?'...':'+ Crear'}
                  </button>
                </form>

                {error && <div style={{ fontSize:12,color:'var(--red)',background:'var(--red-l)',borderRadius:'var(--r)',padding:'8px 12px',marginBottom:12 }}>⚠ {error}</div>}

                {loading ? <div className="spinner"/> : projects.length === 0 ? (
                  <div className="empty-state" style={{ padding:'24px 0' }}>
                    <div className="empty-state-icon">🏥</div>
                    <div className="empty-state-title">Sin proyectos</div>
                    <div className="empty-state-sub">Crea tu primer proyecto arriba</div>
                  </div>
                ) : projects.map(p => (
                  <div key={p.id} style={{ borderBottom:'1px solid var(--border)',paddingBottom:12,marginBottom:12 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <span style={{ fontSize:18,flexShrink:0 }}>🏥</span>
                      {editingId === p.id ? (
                        <input className="form-input" style={{ flex:1,marginBottom:0,fontSize:13,padding:'5px 10px' }} value={editName} onChange={e=>setEditName(e.target.value)} autoFocus onKeyDown={e=>{if(e.key==='Enter')saveEdit(p.id);if(e.key==='Escape')setEditingId(null)}}/>
                      ) : (
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700,fontSize:13,color:p.active?'var(--text-1)':'var(--text-4)' }}>{p.name}</div>
                          <div style={{ fontSize:11,color:'var(--text-4)',marginTop:1 }}>
                            {p.active?'● Activo':'○ Inactivo'}
                            {' · '}<span style={{ color:'var(--accent)',fontWeight:600 }}>{workerCount(p.name)} profesionale{workerCount(p.name)!==1?'s':''}</span>
                          </div>
                        </div>
                      )}
                      <div style={{ display:'flex',gap:4,flexShrink:0 }}>
                        {editingId===p.id ? (
                          <><button className="btn btn-success btn-xs" onClick={()=>saveEdit(p.id)}>✓</button><button className="btn btn-xs" onClick={()=>setEditingId(null)}>✕</button></>
                        ) : (
                          <><button className="btn btn-xs" onClick={()=>{setEditingId(p.id);setEditName(p.name)}}>✏</button><button className="btn btn-xs" onClick={()=>toggleProject(p.id,p.active)}>{p.active?'⏸':'▶'}</button><button className="btn btn-danger btn-xs" onClick={()=>deleteProject(p.id,p.name)}>🗑</button></>
                        )}
                      </div>
                    </div>

                    {/* Assigned workers preview + assign button */}
                    <div style={{ marginTop:10,paddingLeft:28 }}>
                      {workers.filter(w=>w.project===p.name).length > 0 ? (
                        <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginBottom:8 }}>
                          {workers.filter(w=>w.project===p.name).map(w=>(
                            <span key={w.id} style={{ fontSize:11,fontWeight:600,background:'var(--navy-100)',color:'var(--navy-700)',borderRadius:20,padding:'2px 10px' }}>
                              {w.full_name?.split(' ')[0]} ({w.role_label?.split('/')[0]||w.role_label})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize:11,color:'var(--text-4)',marginBottom:8 }}>Sin profesionales asignados</div>
                      )}
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => openAssign(p)}
                        style={{ fontSize:11 }}
                      >
                        👥 Asignar profesionales →
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right column */}
              <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                <div className="card" style={{ marginBottom:0 }}>
                  <div className="card-title" style={{ marginBottom:14 }}>🏢 Empresa</div>
                  <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <input className="form-input" defaultValue="Speech Psychology & CardioHome" readOnly style={{ background:'var(--slate-50)',color:'var(--text-3)' }}/>
                  </div>
                </div>
                <div className="card" style={{ marginBottom:0 }}>
                  <div className="card-title" style={{ marginBottom:14 }}>⏰ Parámetros de atrasos</div>
                  <div className="form-group">
                    <label className="form-label">Límite mensual (alerta crítica)</label>
                    <input className="form-input" type="number" defaultValue={2} min={1}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tolerancia puntualidad (minutos)</label>
                    <input className="form-input" type="number" defaultValue={5} min={0}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Anticipación inasistencias (horas)</label>
                    <input className="form-input" type="number" defaultValue={24} min={0}/>
                  </div>
                  <button className="btn btn-primary btn-sm">💾 Guardar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
