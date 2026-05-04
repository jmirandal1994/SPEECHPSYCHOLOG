import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLE_KEYS = [
  { label: 'Enfermera/o',          feeKey: 'fee_enfermera', reqKey: 'required_enfermera' },
  { label: 'TENS',                 feeKey: 'fee_tens',      reqKey: 'required_tens' },
  { label: 'Auxiliar de servicio', feeKey: 'fee_auxiliar',  reqKey: 'required_auxiliar' },
  { label: 'Administrativo',       feeKey: 'fee_admin',     reqKey: 'required_admin' },
]

const DEFAULT_SCHEDULE = {
  mon: { active: true,  start: '08:00', end: '17:00' },
  tue: { active: true,  start: '08:00', end: '17:00' },
  wed: { active: true,  start: '08:00', end: '17:00' },
  thu: { active: true,  start: '08:00', end: '17:00' },
  fri: { active: true,  start: '08:00', end: '16:00' },
  sat: { active: false, start: '08:00', end: '14:00' },
  sun: { active: false, start: '08:00', end: '14:00' },
}

const EMPTY_P = {
  name: '', description: '', location: '', hospital: '',
  fee_enfermera: 35000, fee_tens: 28000, fee_auxiliar: 22000, fee_admin: 30000,
  required_enfermera: 0, required_tens: 0, required_auxiliar: 0, required_admin: 0,
  schedule: DEFAULT_SCHEDULE,
}

const DAY_LABELS = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles',
  thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo'
}

function fmtCLP(n) { return `$${Number(n||0).toLocaleString('es-CL')} CLP` }

export default function Settings() {
  const [projects,   setProjects]  = useState([])
  const [workers,    setWorkers]   = useState([])
  const [loading,    setLoading]   = useState(true)
  const [saving,     setSaving]    = useState(false)
  const [error,      setError]     = useState('')

  // Global rates from Supabase
  const [rates,      setRates]     = useState({ 'Enfermera/o': 35000, 'TENS': 28000, 'Auxiliar de servicio': 22000, 'Administrativo': 30000 })
  const [rateForm,   setRateForm]  = useState({})
  const [editRates,  setEditRates] = useState(false)

  // Project modal
  const [projModal,  setProjModal] = useState(null)  // null | 'new' | project
  const [projForm,   setProjForm]  = useState(EMPTY_P)

  // Assign modal
  const [assignProj, setAssignProj]   = useState(null)
  const [assignSel,  setAssignSel]    = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: p }, { data: w }, { data: cfg }] = await Promise.all([
      supabase.from('projects').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role_label, project').eq('role','worker').eq('status','active').order('full_name'),
      supabase.from('system_config').select('*'),
    ])
    setProjects(p || [])
    setWorkers(w || [])
    const r = (cfg||[]).find(c=>c.key==='role_fees')
    if (r?.value) { setRates(r.value); setRateForm(r.value) }
    else setRateForm({ 'Enfermera/o': 35000, 'TENS': 28000, 'Auxiliar de servicio': 22000, 'Administrativo': 30000 })
    setLoading(false)
  }

  // Save global rates to Supabase
  async function saveRates() {
    setSaving(true)
    await supabase.from('system_config').upsert([{ key: 'role_fees', value: rateForm, updated_at: new Date().toISOString() }])
    setRates(rateForm)
    setEditRates(false)
    setSaving(false)
  }

  // Project form
  function pf(k, v) { setProjForm(prev => ({ ...prev, [k]: v })) }

  function openNew() {
    setProjForm({ ...EMPTY_P, fee_enfermera: rates['Enfermera/o']||35000, fee_tens: rates['TENS']||28000, fee_auxiliar: rates['Auxiliar de servicio']||22000, fee_admin: rates['Administrativo']||30000 })
    setProjModal('new'); setError('')
  }

  function openEditProj(p) {
    setProjForm({ name: p.name||'', description: p.description||'', location: p.location||'', hospital: p.hospital||'', fee_enfermera: p.fee_enfermera||35000, fee_tens: p.fee_tens||28000, fee_auxiliar: p.fee_auxiliar||22000, fee_admin: p.fee_admin||30000, required_enfermera: p.required_enfermera||0, required_tens: p.required_tens||0, required_auxiliar: p.required_auxiliar||0, required_admin: p.required_admin||0, schedule: p.schedule||DEFAULT_SCHEDULE })
    setProjModal(p); setError('')
  }

  async function saveProject(e) {
    e.preventDefault()
    if (!projForm.name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    const data = { name: projForm.name.trim(), description: projForm.description||null, location: projForm.location||null, hospital: projForm.hospital||null, fee_enfermera: Number(projForm.fee_enfermera)||0, fee_tens: Number(projForm.fee_tens)||0, fee_auxiliar: Number(projForm.fee_auxiliar)||0, fee_admin: Number(projForm.fee_admin)||0, required_enfermera: Number(projForm.required_enfermera)||0, required_tens: Number(projForm.required_tens)||0, required_auxiliar: Number(projForm.required_auxiliar)||0, required_admin: Number(projForm.required_admin)||0, active: true, schedule: projForm.schedule || DEFAULT_SCHEDULE }
    const { error: err } = projModal==='new'
      ? await supabase.from('projects').insert([data])
      : await supabase.from('projects').update(data).eq('id', projModal.id)
    if (err) setError(err.code==='23505'?'Ya existe un proyecto con ese nombre.':err.message)
    else { setProjModal(null); loadAll() }
    setSaving(false)
  }

  async function deleteProj(id, name) {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(p => p.filter(x=>x.id!==id))
  }

  async function toggleProj(id, active) {
    await supabase.from('projects').update({ active: !active }).eq('id', id)
    setProjects(p => p.map(x=>x.id===id?{...x,active:!active}:x))
  }

  // Assign workers
  function openAssign(p) { setAssignProj(p); setAssignSel(workers.filter(w=>w.project===p.name).map(w=>w.id)) }

  async function saveAssign() {
    setSaving(true)
    const pName = assignProj.name
    for (const id of assignSel) await supabase.from('profiles').update({ project: pName }).eq('id', id)
    const toRemove = workers.filter(w=>w.project===pName&&!assignSel.includes(w.id)).map(w=>w.id)
    for (const id of toRemove) await supabase.from('profiles').update({ project: null }).eq('id', id)
    await loadAll(); setAssignProj(null); setSaving(false)
  }

  function projWorkers(pName) { return workers.filter(w=>w.project===pName) }

  const totalCostPerTurn = (p) => ROLE_KEYS.reduce((s,r)=>s+(p[r.reqKey]||0)*(p[r.feeKey]||0),0)

  if (loading) return (
    <div className="page-enter">
      <div className="topbar"><div className="topbar-left"><div className="topbar-title">Configuración</div></div></div>
      <div className="content"><div className="empty-state" style={{marginTop:60}}><div className="spinner" style={{width:28,height:28}}/></div></div>
    </div>
  )

  return (
    <div className="page-enter">

      {/* ══ PROJECT MODAL ══ */}
      {projModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'var(--surface)',borderRadius:'var(--r-lg)',padding:28,width:'100%',maxWidth:620,maxHeight:'92vh',overflowY:'auto',boxShadow:'var(--sh-lg)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:17,fontWeight:800}}>{projModal==='new'?'➕ Crear proyecto':'✏ Editar proyecto'}</div>
                <div style={{fontSize:12,color:'var(--text-4)',marginTop:3}}>Configura dotación y honorarios por cargo</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setProjModal(null)}>✕</button>
            </div>

            {error && <div style={{background:'var(--red-l)',border:'1px solid #fca5a5',borderRadius:'var(--r)',padding:'10px',fontSize:12,color:'var(--red)',marginBottom:14}}>⚠ {error}</div>}

            <form onSubmit={saveProject}>
              {/* Info */}
              <div style={{background:'var(--slate-50)',borderRadius:'var(--r-md)',padding:'16px',marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📋 Información del proyecto</div>
                <div className="g2" style={{marginBottom:0}}>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" required placeholder="Ej: CardioHome Sur" value={projForm.name} onChange={e=>pf('name',e.target.value)}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hospital / CESFAM</label>
                    <input className="form-input" placeholder="Ej: Hospital Barros Luco" value={projForm.hospital} onChange={e=>pf('hospital',e.target.value)}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ubicación / Dirección</label>
                    <input className="form-input" placeholder="Ej: Av. Gran Avenida 3204" value={projForm.location} onChange={e=>pf('location',e.target.value)}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <input className="form-input" placeholder="Descripción breve..." value={projForm.description} onChange={e=>pf('description',e.target.value)}/>
                  </div>
                </div>
              </div>

              {/* Dotation + fees */}
              <div style={{background:'var(--navy-50)',borderRadius:'var(--r-md)',padding:'16px',marginBottom:16,border:'1px solid var(--navy-200)'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>👥 Dotación requerida + Honorario por turno</div>
                <div style={{fontSize:12,color:'var(--text-4)',marginBottom:14}}>Por cada cargo: cuántos necesitas y cuánto se les paga por turno en este proyecto</div>
                {ROLE_KEYS.map(r => (
                  <div key={r.label} style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr',gap:12,alignItems:'center',padding:'12px 14px',background:'var(--surface)',borderRadius:'var(--r)',border:'1px solid var(--border)',marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13}}>{r.label}</div>
                      <div style={{fontSize:11,color:'var(--text-4)'}}>por turno</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--text-4)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>Dotación requerida</div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <button type="button" className="btn btn-xs" style={{width:28,justifyContent:'center',flexShrink:0}} onClick={()=>pf(r.reqKey,Math.max(0,(projForm[r.reqKey]||0)-1))}>−</button>
                        <span style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:18,minWidth:28,textAlign:'center'}}>{projForm[r.reqKey]||0}</span>
                        <button type="button" className="btn btn-primary btn-xs" style={{width:28,justifyContent:'center',flexShrink:0}} onClick={()=>pf(r.reqKey,(projForm[r.reqKey]||0)+1)}>+</button>
                        <span style={{fontSize:11,color:'var(--text-4)'}}>person.</span>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--text-4)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>Honorario / turno</div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <input type="number" className="form-input" style={{marginBottom:0,fontFamily:'var(--font-mono)',fontWeight:700,textAlign:'right',width:'100%'}} min={0} value={projForm[r.feeKey]||''} onChange={e=>pf(r.feeKey,Number(e.target.value))}/>
                        <span style={{fontSize:11,color:'var(--text-4)',flexShrink:0}}>CLP</span>
                      </div>
                      <div style={{fontSize:11,color:'var(--emerald)',marginTop:3,textAlign:'right',fontWeight:700}}>{fmtCLP(projForm[r.feeKey])}</div>
                    </div>
                  </div>
                ))}

                {/* Total cost estimate */}
                {ROLE_KEYS.some(r=>(projForm[r.reqKey]||0)>0) && (
                  <div style={{marginTop:12,padding:'12px 14px',background:'var(--navy-100)',borderRadius:'var(--r)',border:'1px solid var(--navy-300)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--navy-700)'}}>💰 Costo estimado por turno completo</div>
                      <div style={{fontSize:11,color:'var(--navy-600)',marginTop:2}}>
                        {ROLE_KEYS.filter(r=>(projForm[r.reqKey]||0)>0).map(r=>`${projForm[r.reqKey]} ${r.label}`).join(' + ')}
                      </div>
                    </div>
                    <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:20,color:'var(--navy-700)'}}>
                      ${ROLE_KEYS.reduce((s,r)=>s+(projForm[r.reqKey]||0)*(projForm[r.feeKey]||0),0).toLocaleString('es-CL')} CLP
                    </div>
                  </div>
                )}
              </div>


              {/* Schedule editor */}
              <div style={{background:'var(--slate-50)',borderRadius:'var(--r-md)',padding:'16px',marginBottom:16,border:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>📅 Horario por día de semana</div>
                <div style={{fontSize:12,color:'var(--text-4)',marginBottom:14}}>Define los días y horarios de operación de este proyecto</div>
                {Object.entries(DAY_LABELS).map(([day, label]) => {
                  const dayData = (projForm.schedule||DEFAULT_SCHEDULE)[day] || { active: false, start: '08:00', end: '17:00' }
                  return (
                    <div key={day} style={{display:'grid',gridTemplateColumns:'110px 44px 1fr',gap:10,alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                      <div style={{fontWeight:600,fontSize:13,color:dayData.active?'var(--text-1)':'var(--text-4)'}}>{label}</div>
                      <div
                        onClick={()=>pf('schedule',{...(projForm.schedule||DEFAULT_SCHEDULE),[day]:{...dayData,active:!dayData.active}})}
                        style={{width:40,height:22,borderRadius:11,background:dayData.active?'var(--accent)':'var(--slate-300)',cursor:'pointer',position:'relative',transition:'all 0.2s',flexShrink:0}}
                      >
                        <div style={{position:'absolute',top:2,left:dayData.active?20:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'all 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}/>
                      </div>
                      {dayData.active ? (
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <input type="time" className="form-input" style={{marginBottom:0,fontSize:12,padding:'5px 8px',width:90}} value={dayData.start} onChange={e=>pf('schedule',{...(projForm.schedule||DEFAULT_SCHEDULE),[day]:{...dayData,start:e.target.value}})}/>
                          <span style={{fontSize:12,color:'var(--text-4)'}}>a</span>
                          <input type="time" className="form-input" style={{marginBottom:0,fontSize:12,padding:'5px 8px',width:90}} value={dayData.end} onChange={e=>pf('schedule',{...(projForm.schedule||DEFAULT_SCHEDULE),[day]:{...dayData,end:e.target.value}})}/>
                          <span style={{fontSize:11,color:'var(--text-4)'}}>
                            ({Math.round((new Date('2000-01-01T'+dayData.end)-new Date('2000-01-01T'+dayData.start))/3600000*10)/10}h)
                          </span>
                        </div>
                      ) : (
                        <span style={{fontSize:12,color:'var(--text-4)',fontStyle:'italic'}}>No operativo</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',gap:10}}>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{flex:1,justifyContent:'center',padding:'13px'}}>
                  {saving?'Guardando...':projModal==='new'?'➕ Crear proyecto':'💾 Guardar cambios'}
                </button>
                <button type="button" className="btn" onClick={()=>setProjModal(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ ASSIGN MODAL ══ */}
      {assignProj && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'var(--surface)',borderRadius:'var(--r-lg)',padding:28,width:'100%',maxWidth:480,maxHeight:'88vh',overflowY:'auto',boxShadow:'var(--sh-lg)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:700}}>👥 Asignar profesionales</div>
                <div style={{fontSize:12,color:'var(--accent)',marginTop:3,fontWeight:600}}>{assignProj.name}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAssignProj(null)}>✕</button>
            </div>

            {/* Dotation summary */}
            {ROLE_KEYS.some(r=>(assignProj[r.reqKey]||0)>0) && (
              <div style={{background:'var(--navy-50)',borderRadius:'var(--r)',padding:'12px 14px',marginBottom:14,border:'1px solid var(--navy-200)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--navy-700)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>Dotación requerida</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {ROLE_KEYS.filter(r=>(assignProj[r.reqKey]||0)>0).map(r=>{
                    const assigned = workers.filter(w=>assignSel.includes(w.id)&&w.role_label===r.label).length
                    const needed   = assignProj[r.reqKey]||0
                    const ok = assigned>=needed
                    return (
                      <div key={r.label} style={{background:ok?'var(--emerald-l)':'var(--amber-l)',borderRadius:'var(--r-sm)',padding:'8px 12px',border:`1px solid ${ok?'#6ee7b7':'#fde68a'}`,textAlign:'center',minWidth:80}}>
                        <div style={{fontSize:11,fontWeight:700,color:ok?'var(--emerald-d)':'#92400e'}}>{r.label.split('/')[0]}</div>
                        <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:16,color:ok?'var(--emerald-d)':'#92400e'}}>{assigned}/{needed}</div>
                        <div style={{fontSize:10,color:ok?'var(--emerald-d)':'#92400e'}}>{ok?'✓ Completo':'Faltan '+(needed-assigned)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {workers.length===0 ? (
              <div className="empty-state" style={{padding:'24px 0'}}>
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">Sin profesionales</div>
                <div className="empty-state-sub">Ve a Personal y agrega profesionales primero</div>
              </div>
            ) : (
              <>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <button className="btn btn-xs" onClick={()=>setAssignSel(workers.map(w=>w.id))}>✓ Todos</button>
                  <button className="btn btn-xs" onClick={()=>setAssignSel([])}>✕ Ninguno</button>
                  <span style={{fontSize:12,color:'var(--text-4)',alignSelf:'center',marginLeft:4}}>
                    {assignSel.length} seleccionado{assignSel.length!==1?'s':''}
                  </span>
                </div>
                {workers.map(w=>{
                  const sel = assignSel.includes(w.id)
                  const feeKey = { 'Enfermera/o':'fee_enfermera','TENS':'fee_tens','Auxiliar de servicio':'fee_auxiliar','Administrativo':'fee_admin' }[w.role_label]
                  const fee = feeKey ? (assignProj[feeKey]||0) : 0
                  return (
                    <div key={w.id} onClick={()=>setAssignSel(prev=>prev.includes(w.id)?prev.filter(x=>x!==w.id):[...prev,w.id])}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:'var(--r)',border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`,background:sel?'var(--navy-50)':'var(--surface)',marginBottom:8,cursor:'pointer',transition:'all 0.15s'}}>
                      <div style={{width:22,height:22,borderRadius:6,flexShrink:0,background:sel?'var(--accent)':'var(--slate-200)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700}}>
                        {sel?'✓':''}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>{w.full_name}</div>
                        <div style={{fontSize:11,color:'var(--text-4)',marginTop:2}}>
                          {w.role_label||'—'}
                          {w.project&&w.project!==assignProj.name&&<span style={{color:'var(--amber)',marginLeft:6}}>· hoy en {w.project}</span>}
                        </div>
                      </div>
                      {fee>0&&<div style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color:'var(--emerald)',flexShrink:0}}>${fee.toLocaleString('es-CL')}</div>}
                    </div>
                  )
                })}
                <div style={{display:'flex',gap:10,marginTop:18}}>
                  <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={saveAssign} disabled={saving}>
                    {saving?'Guardando...':`💾 Guardar (${assignSel.length} profesionales)`}
                  </button>
                  <button className="btn" onClick={()=>setAssignProj(null)}>Cancelar</button>
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
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Crear proyecto</button>
        </div>
      </div>

      <div className="content">
        {/* Global rates */}
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div>
              <div className="card-title">💰 Tarifas globales por cargo</div>
              <div className="card-sub">Valores por defecto al crear nuevos turnos — guardados en Supabase</div>
            </div>
            <button className="btn btn-sm" onClick={()=>{setEditRates(v=>!v);setRateForm({...rates})}}>
              {editRates?'✕ Cancelar':'✏ Editar tarifas'}
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
            {Object.entries(editRates?rateForm:rates).map(([role,fee])=>(
              <div key={role} style={{background:'var(--slate-50)',borderRadius:'var(--r)',padding:'14px 16px',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13}}>{role}</div>
                  <div style={{fontSize:11,color:'var(--text-4)'}}>por turno completado</div>
                </div>
                {editRates ? (
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <input type="number" className="form-input" style={{marginBottom:0,width:110,fontSize:13,padding:'6px 10px',fontFamily:'var(--font-mono)',fontWeight:700,textAlign:'right'}} value={rateForm[role]||''} onChange={e=>setRateForm(prev=>({...prev,[role]:Number(e.target.value)}))} min={0}/>
                    <span style={{fontSize:11,color:'var(--text-4)'}}>CLP</span>
                  </div>
                ) : (
                  <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:16,color:'var(--emerald)'}}>
                    ${Number(fee).toLocaleString('es-CL')} CLP
                  </div>
                )}
              </div>
            ))}
          </div>
          {editRates&&(
            <button className="btn btn-primary" style={{marginTop:14}} onClick={saveRates} disabled={saving}>
              {saving?'Guardando...':'💾 Guardar tarifas en Supabase'}
            </button>
          )}
        </div>

        {/* Projects list */}
        <div className="card-title" style={{marginBottom:10}}>🏥 Proyectos / Licitaciones</div>
        {projects.length===0 ? (
          <div className="empty-state" style={{background:'var(--surface)',borderRadius:'var(--r-md)',padding:'40px 24px',border:'1px solid var(--border)'}}>
            <div className="empty-state-icon">🏥</div>
            <div className="empty-state-title">Sin proyectos creados</div>
            <div className="empty-state-sub">Crea tu primer proyecto con el botón "+ Crear proyecto"</div>
            <button className="btn btn-primary btn-sm" style={{marginTop:14}} onClick={openNew}>+ Crear proyecto</button>
          </div>
        ) : projects.map(p=>{
          const pw  = projWorkers(p.name)
          const cost = totalCostPerTurn(p)
          return (
            <div key={p.id} className="card" style={{marginBottom:14,padding:0,overflow:'hidden'}}>
              {/* Color bar */}
              <div style={{height:4,background:p.active?'linear-gradient(90deg,var(--navy-500),var(--teal))':'var(--slate-300)'}}/>
              <div style={{padding:'16px 20px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                      <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:800,color:'var(--text-1)'}}>{p.name}</div>
                      <span className={`badge ${p.active?'badge-green':'badge-gray'}`}>{p.active?'● Activo':'○ Inactivo'}</span>
                    </div>
                    {(p.hospital||p.location) && (
                      <div style={{fontSize:12,color:'var(--text-4)',marginBottom:4}}>
                        {p.hospital&&<span>🏥 {p.hospital}</span>}
                        {p.location&&<span style={{marginLeft:10}}>📍 {p.location}</span>}
                      </div>
                    )}
                    {p.description&&<div style={{fontSize:12,color:'var(--text-3)'}}>{p.description}</div>}
                    {/* Schedule summary */}
                    {p.schedule && (
                      <div style={{marginTop:6,display:'flex',gap:5,flexWrap:'wrap'}}>
                        {Object.entries(p.schedule).map(([day,d])=> d.active ? (
                          <span key={day} style={{fontSize:10,fontWeight:700,background:'var(--navy-100)',color:'var(--navy-700)',borderRadius:4,padding:'2px 7px'}}>
                            {DAY_LABELS[day]?.slice(0,3)} {d.start}–{d.end}
                          </span>
                        ) : null)}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:12}}>
                    <button className="btn btn-xs btn-primary" onClick={()=>openEditProj(p)}>✏ Editar</button>
                    <button className="btn btn-xs" onClick={()=>toggleProj(p.id,p.active)}>{p.active?'⏸':'▶'}</button>
                    <button className="btn btn-xs btn-danger" onClick={()=>deleteProj(p.id,p.name)}>🗑</button>
                  </div>
                </div>

                {/* Dotation grid */}
                {ROLE_KEYS.some(r=>(p[r.reqKey]||0)>0) && (
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                    {ROLE_KEYS.filter(r=>(p[r.reqKey]||0)>0).map(r=>{
                      const assigned = pw.filter(w=>w.role_label===r.label).length
                      const needed   = p[r.reqKey]||0
                      const ok = assigned>=needed
                      return (
                        <div key={r.label} style={{background:ok?'var(--emerald-l)':'var(--amber-l)',borderRadius:'var(--r-sm)',padding:'8px 12px',border:`1px solid ${ok?'#6ee7b7':'#fde68a'}`,textAlign:'center',minWidth:90}}>
                          <div style={{fontSize:10,fontWeight:700,color:ok?'var(--emerald-d)':'#92400e',marginBottom:2}}>{r.label.split('/')[0]}</div>
                          <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:15,color:ok?'var(--emerald-d)':'#92400e'}}>{assigned}/{needed}</div>
                          <div style={{fontSize:10,color:ok?'var(--emerald-d)':'#92400e'}}>{ok?'✓':'Faltan '+(needed-assigned)}</div>
                          <div style={{fontSize:10,color:ok?'var(--emerald-d)':'#b45309',marginTop:2,fontFamily:'var(--font-mono)'}}>${(p[r.feeKey]||0).toLocaleString('es-CL')}</div>
                        </div>
                      )
                    })}
                    {cost>0&&(
                      <div style={{background:'var(--navy-100)',borderRadius:'var(--r-sm)',padding:'8px 12px',border:'1px solid var(--navy-300)',textAlign:'center',minWidth:90}}>
                        <div style={{fontSize:10,fontWeight:700,color:'var(--navy-700)',marginBottom:2}}>COSTO TURNO</div>
                        <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:13,color:'var(--navy-700)'}}>${cost.toLocaleString('es-CL')}</div>
                        <div style={{fontSize:10,color:'var(--navy-600)'}}>CLP total</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Assigned workers */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {pw.length>0 ? pw.map(w=>(
                      <span key={w.id} style={{fontSize:11,fontWeight:600,background:'var(--navy-100)',color:'var(--navy-700)',borderRadius:20,padding:'3px 10px'}}>
                        {w.full_name?.split(' ').slice(0,2).join(' ')} · {w.role_label?.split('/')[0]||w.role_label}
                      </span>
                    )) : <span style={{fontSize:12,color:'var(--text-4)'}}>Sin profesionales asignados</span>}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{flexShrink:0,marginLeft:12}} onClick={()=>openAssign(p)}>
                    👥 Asignar →
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
