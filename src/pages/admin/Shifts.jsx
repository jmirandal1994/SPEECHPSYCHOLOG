import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_MAP = {
  completed:   { cls: 'badge-green', label: 'Completado' },
  in_progress: { cls: 'badge-teal',  label: '● En curso' },
  scheduled:   { cls: 'badge-gray',  label: 'Programado' },
  late:        { cls: 'badge-amber', label: '⚠ Con atraso' },
  absent:      { cls: 'badge-red',   label: 'Inasistencia' },
}

// Fees per role — reads from Settings (localStorage) or defaults
function getRoleFees() {
  try { return JSON.parse(localStorage.getItem('sp_rates') || 'null') || { 'Enfermera/o': 35000, 'TENS': 28000, 'Auxiliar de servicio': 22000, 'Administrativo': 30000 } }
  catch { return { 'Enfermera/o': 35000, 'TENS': 28000, 'Auxiliar de servicio': 22000, 'Administrativo': 30000 } }
}
const ROLE_FEES = getRoleFees()

const EMPTY = { worker_id: '', project: '', shift_date: '', start_time: '08:00', end_time: '20:00', fee: '', notes: '' }

export default function Shifts() {
  const [shifts,    setShifts]   = useState([])
  const [workers,   setWorkers]  = useState([])
  const [projects,  setProjects] = useState([])
  const [loading,   setLoading]  = useState(true)
  const [showForm,  setShowForm] = useState(false)
  const [saving,    setSaving]   = useState(false)
  const [error,     setError]    = useState('')
  const [filter,    setFilter]   = useState('all')
  const [filterW,   setFilterW]  = useState('all')
  const [form,      setForm]     = useState(EMPTY)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: s }, { data: w }, { data: p }] = await Promise.all([
      supabase.from('shifts').select('*, profiles(full_name, role_label, project)').order('shift_date', { ascending: false }).limit(100),
      supabase.from('profiles').select('id, full_name, role_label, project').eq('role', 'worker').eq('status', 'active').order('full_name'),
      supabase.from('projects').select('*').eq('active', true).order('name'),
    ])
    setShifts(s || [])
    setWorkers(w || [])
    setProjects(p || [])
    setLoading(false)
  }

  function f(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  // When worker selected, auto-fill project + suggested fee based on role
  function onWorkerChange(workerId) {
    f('worker_id', workerId)
    const w = workers.find(x => x.id === workerId)
    if (w) {
      if (w.project) f('project', w.project)
      const suggestedFee = ROLE_FEES[w.role_label] || ''
      if (!form.fee) f('fee', String(suggestedFee))
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true); setError('')
    if (!form.worker_id) { setError('Selecciona un profesional'); setSaving(false); return }
    if (!form.shift_date) { setError('Selecciona una fecha'); setSaving(false); return }
    if (!form.fee || Number(form.fee) <= 0) { setError('Ingresa el honorario del turno'); setSaving(false); return }

    const { error: err } = await supabase.from('shifts').insert([{
      worker_id:  form.worker_id,
      project:    form.project || null,
      shift_date: form.shift_date,
      start_time: form.start_time,
      end_time:   form.end_time,
      fee:        Number(form.fee),
      notes:      form.notes || null,
      status:     'scheduled',
    }])

    if (err) { setError(err.message) }
    else { setShowForm(false); setForm(EMPTY); loadData() }
    setSaving(false)
  }

  async function markStatus(id, status) {
    await supabase.from('shifts').update({ status }).eq('id', id)
    setShifts(s => s.map(x => x.id === id ? { ...x, status } : x))
  }

  async function deleteShift(id) {
    if (!confirm('¿Eliminar este turno?')) return
    await supabase.from('shifts').delete().eq('id', id)
    setShifts(s => s.filter(x => x.id !== id))
  }

  const allProjects = [...new Set([...projects.map(p=>p.name), ...shifts.map(s=>s.project).filter(Boolean)])]

  let displayed = shifts
  if (filter !== 'all') displayed = displayed.filter(s => s.status === filter)
  if (filterW !== 'all') displayed = displayed.filter(s => s.worker_id === filterW)

  const totalFee = displayed.filter(s=>s.status==='completed'||s.status==='late').reduce((a,s)=>a+(s.fee||0),0)

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Gestión de Turnos</div>
          <div className="topbar-sub">{shifts.length} turno{shifts.length!==1?'s':''} · {totalFee>0?`$${(totalFee/1000).toFixed(0)}K completados`:''}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowForm(v=>!v);setError('');setForm(EMPTY)}}>
            {showForm?'✕ Cancelar':'+ Nuevo turno'}
          </button>
        </div>
      </div>

      <div className="content">
        {/* Form */}
        {showForm && (
          <div className="card" style={{borderColor:'var(--navy-300)',boxShadow:'var(--sh-accent)',marginBottom:16}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,marginBottom:18}}>Programar nuevo turno</div>

            {error && <div style={{background:'var(--red-l)',border:'1px solid #fca5a5',borderRadius:'var(--r)',padding:'10px 14px',fontSize:12,color:'var(--red)',marginBottom:14}}>⚠ {error}</div>}

            {workers.length === 0 && (
              <div className="alert alert-warn" style={{marginBottom:14}}>
                <span className="alert-icon">⚠</span>
                <div className="alert-body"><div className="alert-msg">Primero agrega profesionales en <strong>👥 Personal</strong>.</div></div>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="g2" style={{marginBottom:0}}>
                <div className="form-group">
                  <label className="form-label">Profesional *</label>
                  <select className="form-input" required value={form.worker_id} onChange={e=>onWorkerChange(e.target.value)}>
                    <option value="">Seleccionar profesional...</option>
                    {workers.map(w=>(
                      <option key={w.id} value={w.id}>{w.full_name} — {w.role_label||'sin cargo'}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Proyecto</label>
                  <select className="form-input" value={form.project} onChange={e=>f('project',e.target.value)}>
                    <option value="">Sin proyecto</option>
                    {allProjects.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input type="date" className="form-input" required value={form.shift_date} onChange={e=>f('shift_date',e.target.value)}/>
                </div>

                <div className="form-group">
                  <label className="form-label">Honorario del turno (CLP) *</label>
                  <input type="number" className="form-input" required placeholder="Ej: 28000" min="1"
                    value={form.fee} onChange={e=>f('fee',e.target.value)}/>
                  {form.worker_id && (
                    <div style={{fontSize:11,color:'var(--text-4)',marginTop:4}}>
                      Sugerido según cargo: <strong style={{color:'var(--accent)'}}>
                        ${(ROLE_FEES[workers.find(w=>w.id===form.worker_id)?.role_label]||0).toLocaleString('es-CL')} CLP
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
                  <label className="form-label">Notas (opcional)</label>
                  <textarea className="form-input" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)}/>
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving||workers.length===0}>
                {saving?'Guardando...':'💾 Guardar turno'}
              </button>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{padding:'12px 18px',marginBottom:14}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <select className="form-input" style={{marginBottom:0,fontSize:12,padding:'6px 10px',width:180}}
              value={filterW} onChange={e=>setFilterW(e.target.value)}>
              <option value="all">👥 Todos los profesionales</option>
              {workers.map(w=><option key={w.id} value={w.id}>{w.full_name}</option>)}
            </select>
          </div>
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
                ) : displayed.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📅</div>
                      <div className="empty-state-title">{shifts.length===0?'Sin turnos creados':'Sin turnos con este filtro'}</div>
                      <div className="empty-state-sub">{shifts.length===0?'Crea el primer turno arriba':'Cambia el filtro'}</div>
                    </div>
                  </td></tr>
                ) : displayed.map(s => {
                  const b = STATUS_MAP[s.status]||STATUS_MAP.scheduled
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{fontWeight:600,color:'var(--text-1)',fontSize:13}}>{s.profiles?.full_name||'—'}</div>
                        <div style={{fontSize:11,color:'var(--text-4)'}}>{s.profiles?.role_label}</div>
                      </td>
                      <td>{s.project?<span className="badge badge-blue">{s.project}</span>:<span style={{color:'var(--text-4)',fontSize:12}}>—</span>}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.shift_date}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.start_time} – {s.end_time}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td style={{fontWeight:800,fontFamily:'var(--font-mono)',color:'var(--emerald)',fontSize:13}}>
                        {s.fee?`$${Number(s.fee).toLocaleString('es-CL')}`:'—'}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          {s.status==='scheduled' && <button className="btn btn-success btn-xs" onClick={()=>markStatus(s.id,'completed')}>✓</button>}
                          {s.status==='scheduled' && <button className="btn btn-xs" onClick={()=>markStatus(s.id,'absent')}>✗</button>}
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
