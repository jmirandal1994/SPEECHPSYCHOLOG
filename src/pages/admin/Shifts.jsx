import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_MAP = {
  completed:   { cls: 'badge-green', label: 'Completado' },
  in_progress: { cls: 'badge-teal',  label: '● En curso' },
  scheduled:   { cls: 'badge-gray',  label: 'Programado' },
  late:        { cls: 'badge-amber', label: '⚠ Con atraso' },
  absent:      { cls: 'badge-red',   label: 'Inasistencia' },
  cancelled:   { cls: 'badge-red',   label: 'Cancelado' },
}

export default function Shifts() {
  const [shifts, setShifts]     = useState([])
  const [workers, setWorkers]   = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({
    worker_id: '', project: '', shift_date: '', start_time: '08:00', end_time: '20:00', fee: 28000, notes: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: s }, { data: w }, { data: p }] = await Promise.all([
      supabase.from('shifts').select('*, profiles(full_name, role_label)').order('shift_date', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, full_name, role_label').eq('role', 'worker').eq('status', 'active').order('full_name'),
      supabase.from('projects').select('*').eq('active', true).order('name'),
    ])
    setShifts(s || [])
    setWorkers(w || [])
    setProjects(p || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('shifts').insert([{ ...form, status: 'scheduled' }])
    if (!error) { setShowForm(false); loadData() }
    setSaving(false)
  }

  const filtered = shifts.filter(s => filterStatus === 'all' || s.status === filterStatus)

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Gestión de Turnos</div>
          <div className="topbar-sub">{shifts.length} turno{shifts.length !== 1 ? 's' : ''} registrado{shifts.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancelar' : '+ Nuevo turno'}
          </button>
        </div>
      </div>

      <div className="content">
        {showForm && (
          <div className="card" style={{ borderColor: 'var(--navy-300)', boxShadow: 'var(--sh-accent)', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 18 }}>Programar nuevo turno</div>
            {workers.length === 0 && (
              <div className="alert alert-warn" style={{ marginBottom: 14 }}>
                <span className="alert-icon">⚠</span>
                <div className="alert-body"><div className="alert-msg">Primero debes agregar profesionales en la sección <strong>Personal</strong>.</div></div>
              </div>
            )}
            <form onSubmit={handleCreate}>
              <div className="g2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Profesional *</label>
                  <select className="form-input" required value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.full_name} — {w.role_label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proyecto *</label>
                  <select className="form-input" required value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {projects.map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input type="date" className="form-input" required value={form.shift_date} onChange={e => setForm(f => ({ ...f, shift_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Honorario (CLP)</label>
                  <input type="number" className="form-input" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora inicio</label>
                  <input type="time" className="form-input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora fin</label>
                  <input type="time" className="form-input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notas (opcional)</label>
                  <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving || workers.length === 0}>
                {saving ? 'Guardando...' : '💾 Guardar turno'}
              </button>
            </form>
          </div>
        )}

        {/* Filter tabs */}
        <div className="tabs">
          {[['all','Todos'],['scheduled','Programados'],['in_progress','En curso'],['completed','Completados'],['late','Con atraso'],['absent','Inasistencias']].map(([v, l]) => (
            <div key={v} className={`tab ${filterStatus === v ? 'active' : ''}`} onClick={() => setFilterStatus(v)}>{l}</div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Profesional</th><th>Proyecto</th><th>Fecha</th><th>Horario</th><th>Estado</th><th>Honorario</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📅</div>
                      <div className="empty-state-title">{shifts.length === 0 ? 'Aún no hay turnos registrados' : 'Sin turnos con este filtro'}</div>
                      <div className="empty-state-sub">{shifts.length === 0 ? 'Crea el primer turno con el botón de arriba' : 'Prueba cambiando el filtro'}</div>
                    </div>
                  </td></tr>
                ) : filtered.map(s => {
                  const b = STATUS_MAP[s.status] || STATUS_MAP.scheduled
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{s.profiles?.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{s.profiles?.role_label}</div>
                      </td>
                      <td>{s.project ? <span className="badge badge-blue">{s.project}</span> : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.shift_date}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.start_time} – {s.end_time}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {s.fee ? `$${Number(s.fee).toLocaleString('es-CL')}` : '—'}
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
