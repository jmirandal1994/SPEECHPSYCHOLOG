import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Shifts() {
  const [shifts, setShifts]     = useState([])
  const [workers, setWorkers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ worker_id:'', project:'', shift_date:'', start_time:'08:00', end_time:'20:00', fee:28000 })
  const [saving, setSaving]     = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: s }, { data: w }] = await Promise.all([
      supabase.from('shifts').select('*, profiles(full_name, role_label)').order('shift_date', { ascending: false }).limit(30),
      supabase.from('profiles').select('id, full_name').eq('role', 'worker').order('full_name'),
    ])
    setShifts(s || [])
    setWorkers(w || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('shifts').insert([{ ...form, status: 'scheduled' }])
    if (!error) { setShowForm(false); loadData() }
    setSaving(false)
  }

  const MOCK_SHIFTS = [
    { id:1, profiles:{full_name:'María González', role_label:'Enfermera'}, project:'CardioHome Sur', shift_date:'2025-05-15', start_time:'08:00', end_time:'20:00', status:'in_progress', fee:28000 },
    { id:2, profiles:{full_name:'Carlos Ramírez', role_label:'TENS'}, project:'Speech Norte', shift_date:'2025-05-15', start_time:'08:00', end_time:'18:00', status:'in_progress', fee:30000 },
    { id:3, profiles:{full_name:'Ana Pinto', role_label:'Enfermera'}, project:'CardioHome Sur', shift_date:'2025-05-15', start_time:'08:00', end_time:'20:00', status:'late', fee:28000 },
    { id:4, profiles:{full_name:'José Vargas', role_label:'TENS'}, project:'CardioHome Sur', shift_date:'2025-05-15', start_time:'20:00', end_time:'08:00', status:'scheduled', fee:28000 },
    { id:5, profiles:{full_name:'Lucía Pérez', role_label:'Auxiliar'}, project:'CardioHome Norte', shift_date:'2025-05-14', start_time:'08:00', end_time:'20:00', status:'completed', fee:28000 },
    { id:6, profiles:{full_name:'Roberto Salinas', role_label:'TENS'}, project:'CardioHome Sur', shift_date:'2025-05-14', start_time:'20:00', end_time:'08:00', status:'completed', fee:28000 },
  ]

  const STATUS_BADGE = {
    completed:   { cls: 'badge-green', label: 'Completado' },
    in_progress: { cls: 'badge-teal',  label: '● En curso' },
    scheduled:   { cls: 'badge-gray',  label: 'Programado' },
    late:        { cls: 'badge-amber', label: '⚠ Con atraso' },
    absent:      { cls: 'badge-red',   label: 'Inasistencia' },
  }

  const rows = shifts.length ? shifts : MOCK_SHIFTS

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Gestión de Turnos</div>
          <div className="topbar-sub">Control y asignación de turnos</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm">📥 Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nuevo turno</button>
        </div>
      </div>

      <div className="content">
        {showForm && (
          <div className="card" style={{ borderColor:'var(--navy-300)', boxShadow:'var(--sh-accent)' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Programar nuevo turno</div>
                <div className="card-sub">Asigna un turno a un profesional</div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="g2" style={{ marginBottom:0 }}>
                <div className="form-group">
                  <label className="form-label">Profesional *</label>
                  <select className="form-input" required value={form.worker_id} onChange={e => setForm(f=>({...f,worker_id:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proyecto</label>
                  <select className="form-input" value={form.project} onChange={e => setForm(f=>({...f,project:e.target.value}))}>
                    <option>CardioHome Sur</option>
                    <option>CardioHome Norte</option>
                    <option>Speech Centro</option>
                    <option>Speech Norte</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input type="date" className="form-input" required value={form.shift_date} onChange={e => setForm(f=>({...f,shift_date:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Honorario (CLP)</label>
                  <input type="number" className="form-input" value={form.fee} onChange={e => setForm(f=>({...f,fee:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora inicio</label>
                  <input type="time" className="form-input" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora fin</label>
                  <input type="time" className="form-input" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : '💾 Guardar turno'}
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Proyecto</th>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Estado</th>
                  <th>Honorario</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:32}}><div className="spinner"/></td></tr>
                ) : rows.map(s => {
                  const b = STATUS_BADGE[s.status] || STATUS_BADGE.scheduled
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{fontWeight:600,color:'var(--text-1)'}}>{s.profiles?.full_name}</div>
                        <div style={{fontSize:11,color:'var(--text-4)'}}>{s.profiles?.role_label}</div>
                      </td>
                      <td><span className="badge badge-blue">{s.project}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.shift_date}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.start_time} – {s.end_time}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>
                        ${Number(s.fee).toLocaleString('es-CL')}
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
