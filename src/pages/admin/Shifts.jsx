import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_MAP = {
  completed:   { cls: 'badge-green', label: 'Completado' },
  in_progress: { cls: 'badge-teal',  label: '● En curso' },
  scheduled:   { cls: 'badge-gray',  label: 'Programado' },
  late:        { cls: 'badge-amber', label: '⚠ Con atraso' },
  absent:      { cls: 'badge-red',   label: 'Inasistencia' },
}

function fmtCLP(n) { return n ? `$${Number(n).toLocaleString('es-CL')} CLP` : '—' }

const EMPTY = { worker_id: '', project: '', shift_date: '', start_time: '08:00', end_time: '20:00', fee: '', notes: '' }

export default function Shifts() {
  const [shifts,    setShifts]   = useState([])
  const [workers,   setWorkers]  = useState([])
  const [projects,  setProjects] = useState([])
  const [rates,     setRates]    = useState({ 'Enfermera/o': 35000, 'TENS': 28000, 'Auxiliar de servicio': 22000, 'Administrativo': 30000 })
  const [loading,   setLoading]  = useState(true)
  const [showForm,  setShowForm] = useState(false)
  const [saving,    setSaving]   = useState(false)
  const [error,     setError]    = useState('')
  const [filter,    setFilter]   = useState('all')
  const [filterW,   setFilterW]  = useState('all')
  const [form,      setForm]     = useState(EMPTY)

  useEffect(() => {
    loadData()
    // Real-time: auto-update when attendance is marked
    const channel = supabase.channel('shifts_attendance_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendances' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendances' }, () => {
        loadData()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: s }, { data: w }, { data: p }, { data: cfg }] = await Promise.all([
      supabase.from('shifts').select('*, profiles(full_name, role_label), attendances(checked_in_at, checked_out_at, status, checkin_lat, checkin_lng)').order('shift_date', { ascending: false }).limit(100),
      supabase.from('profiles').select('id, full_name, role_label, project').eq('role','worker').eq('status','active').order('full_name'),
      supabase.from('projects').select('*, fee_enfermera, fee_tens, fee_auxiliar, fee_admin').eq('active',true).order('name'),
      supabase.from('system_config').select('*'),
    ])
    setShifts(s || [])
    setWorkers(w || [])
    setProjects(p || [])
    // Load rates from Supabase
    const r = (cfg||[]).find(c=>c.key==='role_fees')
    if (r?.value) setRates(r.value)
    setLoading(false)
  }

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  // When worker changes: auto-fill project + fee from project config or global rates
  function onWorkerChange(workerId) {
    f('worker_id', workerId)
    const w = workers.find(x => x.id === workerId)
    if (!w) return
    // Auto-fill project
    if (w.project) f('project', w.project)
    // Auto-fill fee from project config
    const proj = projects.find(p => p.name === w.project)
    if (proj) {
      const feeMap = { 'Enfermera/o': proj.fee_enfermera, 'TENS': proj.fee_tens, 'Auxiliar de servicio': proj.fee_auxiliar, 'Administrativo': proj.fee_admin }
      const fee = feeMap[w.role_label]
      if (fee) { f('fee', String(fee)); return }
    }
    // Fallback to global rates
    const globalFee = rates[w.role_label]
    if (globalFee) f('fee', String(globalFee))
  }

  // When project changes: update fee based on worker role in that project
  function onProjectChange(projectName) {
    f('project', projectName)
    const w = workers.find(x => x.id === form.worker_id)
    if (!w) return
    const proj = projects.find(p => p.name === projectName)
    if (proj) {
      const feeMap = { 'Enfermera/o': proj.fee_enfermera, 'TENS': proj.fee_tens, 'Auxiliar de servicio': proj.fee_auxiliar, 'Administrativo': proj.fee_admin }
      const fee = feeMap[w.role_label]
      if (fee) f('fee', String(fee))
    }
  }

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError('')
    if (!form.worker_id) { setError('Selecciona un profesional'); setSaving(false); return }
    if (!form.shift_date) { setError('Selecciona una fecha'); setSaving(false); return }
    if (!form.fee || Number(form.fee) <= 0) { setError('El honorario debe ser mayor a 0'); setSaving(false); return }
    const { error: err } = await supabase.from('shifts').insert([{ worker_id: form.worker_id, project: form.project||null, shift_date: form.shift_date, start_time: form.start_time, end_time: form.end_time, fee: Number(form.fee), notes: form.notes||null, status: 'scheduled' }])
    if (err) setError(err.message)
    else { setShowForm(false); setForm(EMPTY); loadData() }
    setSaving(false)
  }

  async function markStatus(id, status) {
    await supabase.from('shifts').update({ status }).eq('id', id)
    setShifts(s => s.map(x => x.id===id ? {...x,status} : x))
  }

  async function deleteShift(id) {
    if (!confirm('¿Eliminar este turno?')) return
    await supabase.from('shifts').delete().eq('id', id)
    setShifts(s => s.filter(x => x.id!==id))
  }

  const allProjects = [...new Set([...projects.map(p=>p.name), ...shifts.map(s=>s.project).filter(Boolean)])]
  let displayed = shifts
  if (filter !== 'all') displayed = displayed.filter(s => s.status===filter)
  if (filterW !== 'all') displayed = displayed.filter(s => s.worker_id===filterW)

  const selectedWorker = workers.find(w => w.id === form.worker_id)
  const selectedProject = projects.find(p => p.name === form.project)
  const suggestedFee = selectedProject && selectedWorker
    ? { 'Enfermera/o': selectedProject.fee_enfermera, 'TENS': selectedProject.fee_tens, 'Auxiliar de servicio': selectedProject.fee_auxiliar, 'Administrativo': selectedProject.fee_admin }[selectedWorker.role_label]
    : selectedWorker ? rates[selectedWorker.role_label] : null

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Gestión de Turnos</div>
          <div className="topbar-sub">{shifts.length} turno{shifts.length!==1?'s':''} registrado{shifts.length!==1?'s':''}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowForm(v=>!v);setError('');setForm(EMPTY)}}>
            {showForm?'✕ Cancelar':'+ Nuevo turno'}
          </button>
        </div>
      </div>

      <div className="content">
        {showForm && (
          <div className="card" style={{borderColor:'var(--navy-300)',boxShadow:'var(--sh-accent)',marginBottom:16}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,marginBottom:16}}>Programar nuevo turno</div>
            {error && <div style={{background:'var(--red-l)',border:'1px solid #fca5a5',borderRadius:'var(--r)',padding:'10px',fontSize:12,color:'var(--red)',marginBottom:12}}>⚠ {error}</div>}
            {workers.length===0 && <div className="alert alert-warn" style={{marginBottom:12}}><span className="alert-icon">⚠</span><div className="alert-body"><div className="alert-msg">Primero agrega profesionales en <strong>👥 Personal</strong>.</div></div></div>}
            <form onSubmit={handleCreate}>
              <div className="g2" style={{marginBottom:0}}>
                <div className="form-group">
                  <label className="form-label">Profesional *</label>
                  <select className="form-input" required value={form.worker_id} onChange={e=>onWorkerChange(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {workers.map(w=><option key={w.id} value={w.id}>{w.full_name} — {w.role_label||'sin cargo'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proyecto</label>
                  <select className="form-input" value={form.project} onChange={e=>onProjectChange(e.target.value)}>
                    <option value="">Sin proyecto</option>
                    {allProjects.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input type="date" className="form-input" required value={form.shift_date} onChange={e=>f('shift_date',e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Honorario (CLP) *</label>
                  <input type="number" className="form-input" required placeholder="Ej: 28000" min="1" value={form.fee} onChange={e=>f('fee',e.target.value)}/>
                  {suggestedFee && (
                    <div style={{fontSize:11,marginTop:4}}>
                      <span style={{color:'var(--text-4)'}}>Tarifa configurada para este cargo/proyecto: </span>
                      <strong style={{color:'var(--emerald)',cursor:'pointer'}} onClick={()=>f('fee',String(suggestedFee))}>
                        ${suggestedFee.toLocaleString('es-CL')} CLP ← click para usar
                      </strong>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Hora inicio</label>
                  <input type="time" className="form-input" value={form.start_time} onChange={e=>f('start_time',e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Hora fin</label>
                  <input type="time" className="form-input" value={form.end_time} onChange={e=>f('end_time',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Notas</label>
                  <textarea className="form-input" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)}/>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving||workers.length===0}>
                {saving?'Guardando...':'💾 Guardar turno'}
              </button>
            </form>
          </div>
        )}

        <div className="card" style={{padding:'12px 18px',marginBottom:14}}>
          <select className="form-input" style={{marginBottom:0,fontSize:12,padding:'6px 10px'}} value={filterW} onChange={e=>setFilterW(e.target.value)}>
            <option value="all">👥 Todos los profesionales</option>
            {workers.map(w=><option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </div>

        <div className="tabs">
          {[['all','Todos'],['scheduled','Programados'],['in_progress','En curso'],['completed','Completados'],['late','Con atraso'],['absent','Inasistencias']].map(([v,l])=>(
            <div key={v} className={`tab ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{l}</div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Profesional</th><th>Proyecto</th><th>Fecha</th><th>Horario</th><th>Estado</th><th>Honorario</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{textAlign:'center',padding:40}}><div className="spinner"/></td></tr>
                ) : displayed.length===0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">📅</div><div className="empty-state-title">{shifts.length===0?'Sin turnos creados':'Sin turnos con este filtro'}</div><div className="empty-state-sub">{shifts.length===0?'Crea el primer turno arriba':'Cambia el filtro'}</div></div></td></tr>
                ) : displayed.map(s=>{
                  const b = STATUS_MAP[s.status]||STATUS_MAP.scheduled
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{fontWeight:600,fontSize:13}}>{s.profiles?.full_name||'—'}</div>
                        <div style={{fontSize:11,color:'var(--text-4)'}}>{s.profiles?.role_label}</div>
                      </td>
                      <td>{s.project?<span className="badge badge-blue">{s.project}</span>:<span style={{color:'var(--text-4)',fontSize:12}}>—</span>}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.shift_date}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.start_time} – {s.end_time}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontWeight:800,color:'var(--emerald)',fontSize:12,whiteSpace:'nowrap'}}>
                        {fmtCLP(s.fee)}
                      </td>
                      {/* Attendance times from real check-in/out */}
                      <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>
                        {s.attendances?.[0] ? (
                          <div>
                            <div style={{color:'var(--emerald)',fontWeight:700}}>↑ {s.attendances[0].checked_in_at ? new Date(s.attendances[0].checked_in_at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}) : '—'}</div>
                            <div style={{color:s.attendances[0].checked_out_at?'#6366f1':'var(--text-4)',fontWeight:s.attendances[0].checked_out_at?700:400}}>
                              {s.attendances[0].checked_out_at ? '↓ ' + new Date(s.attendances[0].checked_out_at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}) : 'Sin salida'}
                            </div>
                            {s.attendances[0].checkin_lat && <div style={{fontSize:9,color:'var(--text-4)',marginTop:2}}>📍 GPS ✓</div>}
                          </div>
                        ) : <span style={{color:'var(--text-4)'}}>Sin marcar</span>}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          {s.status==='scheduled'&&<button className="btn btn-success btn-xs" onClick={()=>markStatus(s.id,'completed')}>✓</button>}
                          {s.status==='scheduled'&&<button className="btn btn-xs" onClick={()=>markStatus(s.id,'absent')}>✗</button>}
                          <button className="btn btn-danger btn-xs" onClick={()=>deleteShift(s.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
