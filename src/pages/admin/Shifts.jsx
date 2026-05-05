import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS = {
  completed:   { cls: 'badge-green', label: 'Completado',   icon: '✅' },
  in_progress: { cls: 'badge-teal',  label: '● En curso',   icon: '🔄' },
  scheduled:   { cls: 'badge-gray',  label: 'Programado',   icon: '📅' },
  late:        { cls: 'badge-amber', label: '⚠ Con atraso', icon: '⏰' },
  absent:      { cls: 'badge-red',   label: 'Inasistencia', icon: '❌' },
}

function fmtCLP(n) { return n ? `$${Number(n).toLocaleString('es-CL')} CLP` : '—' }
function fmtTime(ts) { return ts ? new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}) : '—' }

const EMPTY = { worker_id:'', project:'', shift_date:'', start_time:'08:00', end_time:'17:00', fee:'', notes:'' }

export default function Shifts() {
  const [shifts,   setShifts]   = useState([])
  const [att,      setAtt]      = useState({}) // { shift_id: attendance }
  const [workers,  setWorkers]  = useState([])
  const [projects, setProjects] = useState([])
  const [rates,    setRates]    = useState({ 'Enfermera/o':35000,'TENS':28000,'Auxiliar de servicio':22000,'Administrativo':30000 })
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState('all')
  const [filterW,  setFilterW]  = useState('all')
  const [filterD,  setFilterD]  = useState('all') // all | today | week
  const [form,     setForm]     = useState(EMPTY)

  const today = new Date().toISOString().slice(0,10)

  useEffect(() => {
    loadData()
    // Real-time attendance sync
    const ch = supabase.channel('shifts_rt')
      .on('postgres_changes',{ event:'*', schema:'public', table:'attendances' }, loadAttendances)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'shifts' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: s }, { data: w }, { data: p }, { data: cfg }] = await Promise.all([
      // Simple shifts query — no nested relation to avoid FK issues
      supabase.from('shifts')
        .select('*, profiles(id, full_name, role_label)')
        .order('shift_date',{ ascending:false })
        .limit(200),
      supabase.from('profiles')
        .select('id, full_name, role_label, project')
        .eq('role','worker').eq('status','active').order('full_name'),
      supabase.from('projects')
        .select('id, name, fee_enfermera, fee_tens, fee_auxiliar, fee_admin')
        .eq('active',true).order('name'),
      supabase.from('system_config').select('*'),
    ])
    setShifts(s || [])
    setWorkers(w || [])
    setProjects(p || [])
    const r = (cfg||[]).find(c=>c.key==='role_fees')
    if (r?.value) setRates(r.value)
    setLoading(false)
    // Load attendance separately
    await loadAttendances()
  }

  async function loadAttendances() {
    // Get today + recent attendances linked to shifts
    const { data } = await supabase
      .from('attendances')
      .select('id, worker_id, shift_id, status, checked_in_at, checked_out_at, late_minutes, checkin_lat, checkin_lng')
      .order('checked_in_at',{ ascending:false })
      .limit(500)

    // Index by shift_id (primary) and worker_id+date (fallback)
    const map = {}
    ;(data||[]).forEach(a => {
      if (a.shift_id) map[a.shift_id] = a
    })
    // Also index by worker+date for auto-created shifts without shift_id
    ;(data||[]).forEach(a => {
      if (!a.shift_id && a.checked_in_at) {
        const date = a.checked_in_at.slice(0,10)
        map[`${a.worker_id}_${date}`] = a
      }
    })
    setAtt(map)
  }

  function getAtt(shift) {
    // Try shift_id first, then worker+date
    return att[shift.id] || att[`${shift.worker_id}_${shift.shift_date}`] || null
  }

  function f(k,v) { setForm(p=>({...p,[k]:v})) }

  function onWorkerChange(workerId) {
    f('worker_id', workerId)
    const w = workers.find(x=>x.id===workerId)
    if (!w) return
    if (w.project) f('project', w.project)
    const proj = projects.find(p=>p.name===w.project)
    if (proj) {
      const feeMap = { 'Enfermera/o':proj.fee_enfermera,'TENS':proj.fee_tens,'Auxiliar de servicio':proj.fee_auxiliar,'Administrativo':proj.fee_admin }
      if (feeMap[w.role_label]) { f('fee',String(feeMap[w.role_label])); return }
    }
    if (rates[w.role_label]) f('fee',String(rates[w.role_label]))
  }

  function onProjectChange(projectName) {
    f('project', projectName)
    const w = workers.find(x=>x.id===form.worker_id)
    if (!w) return
    const proj = projects.find(p=>p.name===projectName)
    if (proj) {
      const feeMap = { 'Enfermera/o':proj.fee_enfermera,'TENS':proj.fee_tens,'Auxiliar de servicio':proj.fee_auxiliar,'Administrativo':proj.fee_admin }
      if (feeMap[w.role_label]) f('fee',String(feeMap[w.role_label]))
    }
  }

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError('')
    if (!form.worker_id) { setError('Selecciona un profesional'); setSaving(false); return }
    if (!form.shift_date) { setError('Selecciona una fecha'); setSaving(false); return }
    if (!form.fee || Number(form.fee)<=0) { setError('Ingresa el honorario'); setSaving(false); return }
    const { error:err } = await supabase.from('shifts').insert([{
      worker_id: form.worker_id,
      project:   form.project||null,
      shift_date:form.shift_date,
      start_time:form.start_time,
      end_time:  form.end_time,
      fee:       Number(form.fee),
      notes:     form.notes||null,
      status:    'scheduled',
    }])
    if (err) setError(err.message)
    else { setShowForm(false); setForm(EMPTY); loadData() }
    setSaving(false)
  }

  async function markStatus(id, status) {
    await supabase.from('shifts').update({ status }).eq('id', id)
    setShifts(s=>s.map(x=>x.id===id?{...x,status}:x))
  }

  async function deleteShift(id) {
    if (!confirm('¿Eliminar este turno?')) return
    await supabase.from('shifts').delete().eq('id', id)
    setShifts(s=>s.filter(x=>x.id!==id))
  }

  // Apply filters
  let displayed = [...shifts]
  if (filter  !== 'all') displayed = displayed.filter(s=>s.status===filter)
  if (filterW !== 'all') displayed = displayed.filter(s=>s.worker_id===filterW)
  if (filterD === 'today') displayed = displayed.filter(s=>s.shift_date===today)
  else if (filterD === 'week') {
    const weekAgo = new Date(Date.now()-7*86400000).toISOString().slice(0,10)
    displayed = displayed.filter(s=>s.shift_date>=weekAgo)
  }

  const allProjects = [...new Set([...projects.map(p=>p.name),...shifts.map(s=>s.project).filter(Boolean)])]

  // Stats
  const todayShifts   = shifts.filter(s=>s.shift_date===today)
  const activeNow     = todayShifts.filter(s=>{ const a=getAtt(s); return a?.checked_in_at&&!a?.checked_out_at })
  const completedToday= todayShifts.filter(s=>{ const a=getAtt(s); return !!a?.checked_out_at })

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Gestión de Turnos</div>
          <div className="topbar-sub">{shifts.length} turno{shifts.length!==1?'s':''} · {todayShifts.length} hoy</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={loadData}>↻</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowForm(v=>!v);setError('');setForm(EMPTY)}}>
            {showForm?'✕ Cancelar':'+ Nuevo turno'}
          </button>
        </div>
      </div>

      <div className="content">
        {/* Live stats */}
        <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
          {[
            {label:'Turnos hoy',         value:todayShifts.length,    accent:'accent-blue',  icon:'📅',ibg:'var(--navy-200)',icl:'var(--navy-700)',    delta:'programados'},
            {label:'En curso ahora',      value:activeNow.length,      accent:'accent-teal',  icon:'🔄',ibg:'var(--teal-l)',  icl:'var(--teal)',        delta:'● activos'},
            {label:'Completados hoy',     value:completedToday.length, accent:'accent-green', icon:'✅',ibg:'var(--emerald-l)',icl:'var(--emerald-d)',  delta:'entrada y salida'},
            {label:'Sin marcar hoy',      value:todayShifts.length-activeNow.length-completedToday.length, accent:'accent-amber',icon:'⏳',ibg:'var(--amber-l)',icl:'var(--amber)', delta:'pendientes'},
          ].map(s=>(
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`}/>
              <div className="stat-icon" style={{background:s.ibg,color:s.icl}}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-delta">{s.delta}</div>
            </div>
          ))}
        </div>

        {/* Add form */}
        {showForm && (
          <div className="card" style={{borderColor:'var(--navy-300)',boxShadow:'var(--sh-accent)',marginBottom:16}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,marginBottom:16}}>Programar nuevo turno</div>
            {error&&<div style={{background:'var(--red-l)',border:'1px solid #fca5a5',borderRadius:'var(--r)',padding:'10px',fontSize:12,color:'var(--red)',marginBottom:12}}>⚠ {error}</div>}
            {workers.length===0&&<div className="alert alert-warn" style={{marginBottom:12}}><span className="alert-icon">⚠</span><div className="alert-body"><div className="alert-msg">Primero agrega profesionales en <strong>👥 Personal</strong>.</div></div></div>}
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
                  {form.worker_id&&(
                    <div style={{fontSize:11,color:'var(--text-4)',marginTop:4}}>
                      Tarifa configurada: <strong style={{color:'var(--emerald)',cursor:'pointer'}} onClick={()=>{
                        const w=workers.find(x=>x.id===form.worker_id)
                        const proj=projects.find(p=>p.name===form.project)
                        const feeMap={'Enfermera/o':proj?.fee_enfermera,'TENS':proj?.fee_tens,'Auxiliar de servicio':proj?.fee_auxiliar,'Administrativo':proj?.fee_admin}
                        const fee=feeMap[w?.role_label]||rates[w?.role_label]||0
                        if(fee) f('fee',String(fee))
                      }}>
                        ${((()=>{
                          const w=workers.find(x=>x.id===form.worker_id)
                          const proj=projects.find(p=>p.name===form.project)
                          const fm={'Enfermera/o':proj?.fee_enfermera,'TENS':proj?.fee_tens,'Auxiliar de servicio':proj?.fee_auxiliar,'Administrativo':proj?.fee_admin}
                          return (fm[w?.role_label]||rates[w?.role_label]||0).toLocaleString('es-CL')
                        })()} CLP ← click
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

        {/* Filters bar */}
        <div className="card" style={{padding:'12px 18px',marginBottom:14}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            {/* Date filter */}
            <div style={{display:'flex',gap:4}}>
              {[['all','Todos'],['today','Hoy'],['week','7 días']].map(([v,l])=>(
                <button key={v} className={`btn btn-sm ${filterD===v?'btn-primary':''}`} style={{fontSize:11}} onClick={()=>setFilterD(v)}>{l}</button>
              ))}
            </div>
            <div style={{width:1,height:24,background:'var(--border)'}}/>
            {/* Worker filter */}
            <select className="form-input" style={{marginBottom:0,fontSize:12,padding:'6px 10px',minWidth:160}} value={filterW} onChange={e=>setFilterW(e.target.value)}>
              <option value="all">👥 Todos los profesionales</option>
              {workers.map(w=><option key={w.id} value={w.id}>{w.full_name}</option>)}
            </select>
          </div>
        </div>

        {/* Status tabs */}
        <div className="tabs">
          {[['all','Todos'],['scheduled','Programados'],['in_progress','En curso'],['completed','Completados'],['late','Con atraso'],['absent','Inasistencias']].map(([v,l])=>(
            <div key={v} className={`tab ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{l}</div>
          ))}
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Proyecto</th>
                  <th>Fecha</th>
                  <th>Horario programado</th>
                  <th>Marcaje real</th>
                  <th>Estado</th>
                  <th>Honorario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:40}}><div className="spinner"/></td></tr>
                ) : displayed.length===0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📅</div>
                      <div className="empty-state-title">
                        {shifts.length===0 ? 'Sin turnos registrados aún' : 'Sin turnos con este filtro'}
                      </div>
                      <div className="empty-state-sub">
                        {shifts.length===0
                          ? 'Los turnos se crean automáticamente cuando los profesionales marcan entrada, o puedes crearlos manualmente arriba'
                          : 'Cambia el filtro o el período'}
                      </div>
                    </div>
                  </td></tr>
                ) : displayed.map(s=>{
                  const b  = STATUS[s.status]||STATUS.scheduled
                  const a  = getAtt(s)  // attendance record
                  const isToday = s.shift_date===today

                  // Determine live status from attendance
                  let liveStatus = s.status
                  let displayBadge = b
                  if (a) {
                    if (a.checked_in_at && !a.checked_out_at) {
                      liveStatus = 'in_progress'
                      displayBadge = STATUS.in_progress
                    } else if (a.checked_out_at) {
                      liveStatus = a.status==='late' ? 'late' : 'completed'
                      displayBadge = STATUS[liveStatus]
                    }
                  }

                  return (
                    <tr key={s.id} style={{background:isToday&&a?.checked_in_at&&!a?.checked_out_at?'rgba(8,145,178,0.04)':undefined}}>
                      <td>
                        <div style={{fontWeight:600,fontSize:13,color:'var(--text-1)'}}>{s.profiles?.full_name||'—'}</div>
                        <div style={{fontSize:11,color:'var(--text-4)'}}>{s.profiles?.role_label}</div>
                      </td>
                      <td>{s.project?<span className="badge badge-blue">{s.project}</span>:<span style={{color:'var(--text-4)',fontSize:12}}>—</span>}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>
                        {s.shift_date}
                        {isToday&&<div style={{fontSize:10,color:'var(--accent)',fontWeight:700}}>HOY</div>}
                      </td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.start_time} – {s.end_time}</td>

                      {/* Real attendance times */}
                      <td>
                        {a ? (
                          <div style={{lineHeight:1.7}}>
                            <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--emerald)',fontWeight:700}}>
                              ↑ {fmtTime(a.checked_in_at)}
                              {a.status==='late'&&<span style={{fontSize:10,color:'var(--amber)',marginLeft:4}}>+{a.late_minutes}min</span>}
                            </div>
                            {a.checked_out_at
                              ? <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'#6366f1',fontWeight:700}}>↓ {fmtTime(a.checked_out_at)}</div>
                              : <div style={{fontSize:11,color:'var(--teal)',fontWeight:600}}>● Sin salida aún</div>}
                            {a.checkin_lat&&<div style={{fontSize:9,color:'var(--text-4)',marginTop:1}}>📍 GPS ✓</div>}
                          </div>
                        ) : (
                          <span style={{fontSize:12,color:'var(--text-4)',fontStyle:'italic'}}>
                            {isToday ? 'Sin marcar' : '—'}
                          </span>
                        )}
                      </td>

                      <td><span className={`badge ${displayBadge.cls}`}>{displayBadge.label}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontWeight:800,color:'var(--emerald)',fontSize:12,whiteSpace:'nowrap'}}>{fmtCLP(s.fee)}</td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          {s.status==='scheduled'&&<button className="btn btn-success btn-xs" onClick={()=>markStatus(s.id,'completed')} title="Marcar completado">✓</button>}
                          {s.status==='scheduled'&&<button className="btn btn-xs" onClick={()=>markStatus(s.id,'absent')} title="Marcar inasistencia">✗</button>}
                          <button className="btn btn-danger btn-xs" onClick={()=>deleteShift(s.id)} title="Eliminar">🗑</button>
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
