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

const EMPTY = { worker_id: '', project: '', shift_date: '', start_time: '08:00', end_time: '20:00', fee: '', notes: '' }

export default function Shifts() {
  const [shifts,       setShifts]      = useState([])
  const [workers,      setWorkers]     = useState([])
  const [projects,     setProjects]    = useState([])
  const [loading,      setLoading]     = useState(true)
  const [showForm,     setShowForm]    = useState(false)
  const [saving,       setSaving]      = useState(false)
  const [error,        setError]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form,         setForm]        = useState(EMPTY)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: s }, { data: w }] = await Promise.all([
      supabase.from('shifts')
        .select('*, profiles(full_name, role_label)')
        .order('shift_date', { ascending: false })
        .limit(60),
      supabase.from('profiles')
        .select('id, full_name, role_label, project')
        .eq('role', 'worker')
        .eq('status', 'active')
        .order('full_name'),
    ])

    // Try projects table
    let p = []
    const { data: pData } = await supabase.from('projects').select('*').eq('active', true).order('name')
    if (pData) p = pData

    setShifts(s   || [])
    setWorkers(w  || [])
    setProjects(p)
    setLoading(false)
  }

  function f(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  // When worker changes, auto-fill their project
  function onWorkerChange(workerId) {
    f('worker_id', workerId)
    const worker = workers.find(w => w.id === workerId)
    if (worker?.project && !form.project) f('project', worker.project)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (!form.worker_id) { setError('Selecciona un profesional'); setSaving(false); return }
    if (!form.shift_date) { setError('Selecciona una fecha'); setSaving(false); return }

    const { error: err } = await supabase.from('shifts').insert([{
      worker_id:  form.worker_id,
      project:    form.project   || null,
      shift_date: form.shift_date,
      start_time: form.start_time,
      end_time:   form.end_time,
      fee:        form.fee ? Number(form.fee) : null,
      notes:      form.notes || null,
      status:     'scheduled',
    }])

    if (err) {
      setError(err.message)
    } else {
      setShowForm(false)
      setForm(EMPTY)
      loadData()
    }
    setSaving(false)
  }

  async function deleteShift(id) {
    if (!confirm('¿Eliminar este turno?')) return
    await supabase.from('shifts').delete().eq('id', id)
    setShifts(s => s.filter(x => x.id !== id))
  }

  async function markComplete(id) {
    await supabase.from('shifts').update({ status: 'completed' }).eq('id', id)
    setShifts(s => s.map(x => x.id === id ? { ...x, status: 'completed' } : x))
  }

  const filtered = shifts.filter(s => filterStatus === 'all' || s.status === filterStatus)

  // Collect all project names from shifts + projects table for filter
  const allProjects = [...new Set([
    ...projects.map(p => p.name),
    ...shifts.map(s => s.project).filter(Boolean),
  ])]

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Gestión de Turnos</div>
          <div className="topbar-sub">
            {shifts.length} turno{shifts.length !== 1 ? 's' : ''} registrado{shifts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(v => !v); setError(''); setForm(EMPTY) }}>
            {showForm ? '✕ Cancelar' : '+ Nuevo turno'}
          </button>
        </div>
      </div>

      <div className="content">

        {/* ── ADD FORM ── */}
        {showForm && (
          <div className="card" style={{ borderColor: 'var(--navy-300)', boxShadow: 'var(--sh-accent)', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 18 }}>
              Programar nuevo turno
            </div>

            {error && (
              <div style={{ background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>
                ⚠ {error}
              </div>
            )}

            {workers.length === 0 && (
              <div className="alert alert-warn" style={{ marginBottom: 14 }}>
                <span className="alert-icon">⚠</span>
                <div className="alert-body">
                  <div className="alert-msg">Primero debes agregar profesionales activos en <strong>Personal</strong>.</div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="g2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Profesional *</label>
                  <select className="form-input" required value={form.worker_id} onChange={e => onWorkerChange(e.target.value)}>
                    <option value="">Seleccionar profesional...</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}{w.role_label ? ` — ${w.role_label}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Proyecto</label>
                  <select className="form-input" value={form.project} onChange={e => f('project', e.target.value)}>
                    <option value="">Sin proyecto</option>
                    {allProjects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {allProjects.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                      Sin proyectos. Agrégalos en ⚙ Configuración.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input type="date" className="form-input" required
                    value={form.shift_date} onChange={e => f('shift_date', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Honorario (CLP)</label>
                  <input type="number" className="form-input" placeholder="Ej: 28000"
                    value={form.fee} onChange={e => f('fee', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Hora inicio</label>
                  <input type="time" className="form-input"
                    value={form.start_time} onChange={e => f('start_time', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Hora fin</label>
                  <input type="time" className="form-input"
                    value={form.end_time} onChange={e => f('end_time', e.target.value)} />
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notas (opcional)</label>
                  <textarea className="form-input" rows={2}
                    value={form.notes} onChange={e => f('notes', e.target.value)} />
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving || workers.length === 0}>
                {saving ? 'Guardando...' : '💾 Guardar turno'}
              </button>
            </form>
          </div>
        )}

        {/* ── FILTER TABS ── */}
        <div className="tabs">
          {[['all','Todos'],['scheduled','Programados'],['in_progress','En curso'],['completed','Completados'],['late','Con atraso'],['absent','Inasistencias']].map(([v, l]) => (
            <div key={v} className={`tab ${filterStatus === v ? 'active' : ''}`} onClick={() => setFilterStatus(v)}>
              {l}
            </div>
          ))}
        </div>

        {/* ── TABLE ── */}
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
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                    <div className="spinner" />
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📅</div>
                      <div className="empty-state-title">
                        {shifts.length === 0 ? 'Sin turnos registrados' : 'Sin turnos con este filtro'}
                      </div>
                      <div className="empty-state-sub">
                        {shifts.length === 0 ? 'Crea el primer turno arriba' : 'Cambia el filtro para ver otros'}
                      </div>
                    </div>
                  </td></tr>
                ) : filtered.map(s => {
                  const b = STATUS_MAP[s.status] || STATUS_MAP.scheduled
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13 }}>
                          {s.profiles?.full_name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{s.profiles?.role_label}</div>
                      </td>
                      <td>
                        {s.project
                          ? <span className="badge badge-blue">{s.project}</span>
                          : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.shift_date}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.start_time} – {s.end_time}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {s.fee ? `$${Number(s.fee).toLocaleString('es-CL')}` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {s.status === 'scheduled' && (
                            <button className="btn btn-success btn-xs" onClick={() => markComplete(s.id)}>✓</button>
                          )}
                          <button className="btn btn-danger btn-xs" onClick={() => deleteShift(s.id)}>🗑</button>
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
