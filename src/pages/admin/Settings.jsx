import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLE_KEYS = [
  { label: 'Enfermera/o',          feeKey: 'fee_enfermera', reqKey: 'required_enfermera' },
  { label: 'TENS',                 feeKey: 'fee_tens',      reqKey: 'required_tens' },
  { label: 'Auxiliar de servicio', feeKey: 'fee_auxiliar',  reqKey: 'required_auxiliar' },
  { label: 'Administrativo',       feeKey: 'fee_admin',     reqKey: 'required_admin' },
]

const DAY_KEYS   = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS = { mon:'Lunes', tue:'Martes', wed:'Miércoles', thu:'Jueves', fri:'Viernes', sat:'Sábado', sun:'Domingo' }

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

function fmtCLP(n) { return `$${Number(n || 0).toLocaleString('es-CL')} CLP` }

export default function Settings() {
  const [projects,  setProjects]  = useState([])
  const [workers,   setWorkers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [rates,     setRates]     = useState({ 'Enfermera/o': 35000, 'TENS': 28000, 'Auxiliar de servicio': 22000, 'Administrativo': 30000 })
  const [rateForm,  setRateForm]  = useState({})
  const [editRates, setEditRates] = useState(false)
  const [projModal, setProjModal] = useState(null)  // null | 'new' | project
  const [projForm,  setProjForm]  = useState(EMPTY_P)
  const [assignProj, setAssignProj] = useState(null)
  const [assignSel,  setAssignSel]  = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: p }, { data: w }, { data: cfg }] = await Promise.all([
      supabase.from('projects').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role_label, project').eq('role', 'worker').eq('status', 'active').order('full_name'),
      supabase.from('system_config').select('*'),
    ])
    setProjects(p || [])
    setWorkers(w || [])
    const r = (cfg || []).find(c => c.key === 'role_fees')
    if (r?.value) { setRates(r.value); setRateForm(r.value) }
    else setRateForm({ 'Enfermera/o': 35000, 'TENS': 28000, 'Auxiliar de servicio': 22000, 'Administrativo': 30000 })
    setLoading(false)
  }

  async function saveRates() {
    setSaving(true)
    await supabase.from('system_config').upsert([{ key: 'role_fees', value: rateForm, updated_at: new Date().toISOString() }])
    setRates(rateForm)
    setEditRates(false)
    setSaving(false)
  }

  function pf(k, v) { setProjForm(prev => ({ ...prev, [k]: v })) }

  function openNew() {
    setProjForm({ ...EMPTY_P, fee_enfermera: rates['Enfermera/o'] || 35000, fee_tens: rates['TENS'] || 28000, fee_auxiliar: rates['Auxiliar de servicio'] || 22000, fee_admin: rates['Administrativo'] || 30000, schedule: DEFAULT_SCHEDULE })
    setProjModal('new')
    setError('')
  }

  function openEditProj(p) {
    setProjForm({
      name: p.name || '', description: p.description || '', location: p.location || '', hospital: p.hospital || '',
      fee_enfermera: p.fee_enfermera || 35000, fee_tens: p.fee_tens || 28000, fee_auxiliar: p.fee_auxiliar || 22000, fee_admin: p.fee_admin || 30000,
      required_enfermera: p.required_enfermera || 0, required_tens: p.required_tens || 0, required_auxiliar: p.required_auxiliar || 0, required_admin: p.required_admin || 0,
      schedule: p.schedule || DEFAULT_SCHEDULE,
    })
    setProjModal(p)
    setError('')
  }

  async function saveProject(e) {
    e.preventDefault()
    if (!projForm.name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    const data = {
      name: projForm.name.trim(), description: projForm.description || null, location: projForm.location || null, hospital: projForm.hospital || null,
      fee_enfermera: Number(projForm.fee_enfermera) || 0, fee_tens: Number(projForm.fee_tens) || 0, fee_auxiliar: Number(projForm.fee_auxiliar) || 0, fee_admin: Number(projForm.fee_admin) || 0,
      required_enfermera: Number(projForm.required_enfermera) || 0, required_tens: Number(projForm.required_tens) || 0, required_auxiliar: Number(projForm.required_auxiliar) || 0, required_admin: Number(projForm.required_admin) || 0,
      active: true, schedule: projForm.schedule || DEFAULT_SCHEDULE,
    }
    const { error: err } = projModal === 'new'
      ? await supabase.from('projects').insert([data])
      : await supabase.from('projects').update(data).eq('id', projModal.id)
    if (err) setError(err.code === '23505' ? 'Ya existe un proyecto con ese nombre.' : err.message)
    else { setProjModal(null); loadAll() }
    setSaving(false)
  }

  async function deleteProj(id, name) {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(p => p.filter(x => x.id !== id))
  }

  async function toggleProj(id, active) {
    await supabase.from('projects').update({ active: !active }).eq('id', id)
    setProjects(p => p.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  function openAssign(p) {
    setAssignProj(p)
    setAssignSel(workers.filter(w => w.project === p.name).map(w => w.id))
  }

  async function saveAssign() {
    setSaving(true)
    const pName = assignProj.name
    for (const id of assignSel) await supabase.from('profiles').update({ project: pName }).eq('id', id)
    const toRemove = workers.filter(w => w.project === pName && !assignSel.includes(w.id)).map(w => w.id)
    for (const id of toRemove) await supabase.from('profiles').update({ project: null }).eq('id', id)
    await loadAll()
    setAssignProj(null)
    setSaving(false)
  }

  function updateScheduleDay(day, field, value) {
    const current = projForm.schedule || DEFAULT_SCHEDULE
    pf('schedule', { ...current, [day]: { ...current[day], [field]: value } })
  }

  function projWorkers(pName) { return workers.filter(w => w.project === pName) }
  function totalCost(p) { return ROLE_KEYS.reduce((s, r) => s + (p[r.reqKey] || 0) * (p[r.feeKey] || 0), 0) }

  if (loading) return (
    <div className="page-enter">
      <div className="topbar"><div className="topbar-left"><div className="topbar-title">Configuración</div></div></div>
      <div className="content"><div className="empty-state" style={{ marginTop: 60 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div></div>
    </div>
  )

  const sched = projForm.schedule || DEFAULT_SCHEDULE

  return (
    <div className="page-enter">

      {/* PROJECT MODAL */}
      {projModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 28, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--sh-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800 }}>{projModal === 'new' ? '➕ Crear proyecto' : '✏ Editar proyecto'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>Configura dotación, honorarios y horario</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setProjModal(null); setError('') }}>✕</button>
            </div>

            {error && <div style={{ background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r)', padding: '10px', fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>⚠ {error}</div>}

            <form onSubmit={saveProject}>
              {/* Info section */}
              <div style={{ background: 'var(--slate-50)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📋 Información del proyecto</div>
                <div className="g2" style={{ marginBottom: 0 }}>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" required placeholder="Ej: VACUNACION 2026 LO BARNECHEA" value={projForm.name} onChange={e => pf('name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hospital / CESFAM</label>
                    <input className="form-input" placeholder="Ej: CESFAM Lo Barnechea" value={projForm.hospital} onChange={e => pf('hospital', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección</label>
                    <input className="form-input" placeholder="Ej: Av. Las Condes 14801" value={projForm.location} onChange={e => pf('location', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <input className="form-input" placeholder="Descripción breve..." value={projForm.description} onChange={e => pf('description', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Schedule section */}
              <div style={{ background: 'var(--navy-50)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 14, border: '1px solid var(--navy-200)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>📅 Horario de operación por día</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>Activa los días que opera este proyecto y define los horarios</div>
                {DAY_KEYS.map(day => {
                  const d = sched[day] || { active: false, start: '08:00', end: '17:00' }
                  return (
                    <div key={day} style={{ display: 'grid', gridTemplateColumns: '110px 50px 1fr', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: d.active ? 'var(--text-1)' : 'var(--text-4)' }}>{DAY_LABELS[day]}</div>
                      {/* Toggle */}
                      <div
                        onClick={() => updateScheduleDay(day, 'active', !d.active)}
                        style={{ width: 42, height: 24, borderRadius: 12, background: d.active ? 'var(--accent)' : 'var(--slate-300)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                      >
                        <div style={{ position: 'absolute', top: 3, left: d.active ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                      </div>
                      {d.active ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="time" className="form-input" style={{ marginBottom: 0, fontSize: 13, padding: '5px 8px', width: 100 }} value={d.start} onChange={e => updateScheduleDay(day, 'start', e.target.value)} />
                          <span style={{ fontSize: 12, color: 'var(--text-4)', flexShrink: 0 }}>→</span>
                          <input type="time" className="form-input" style={{ marginBottom: 0, fontSize: 13, padding: '5px 8px', width: 100 }} value={d.end} onChange={e => updateScheduleDay(day, 'end', e.target.value)} />
                          <span style={{ fontSize: 11, color: 'var(--text-4)', flexShrink: 0 }}>
                            ({Math.round(((new Date('2000-01-01T' + d.end)) - (new Date('2000-01-01T' + d.start))) / 3600000 * 10) / 10}h)
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>No operativo</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Dotation + fees */}
              <div style={{ background: 'var(--emerald-l)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 14, border: '1px solid #6ee7b7' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>👥 Dotación requerida + Honorario por turno</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>Cuántos profesionales necesitas de cada cargo y cuánto se les paga por turno</div>
                {ROLE_KEYS.map(r => (
                  <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--border)', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>por turno</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Dotación</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" className="btn btn-xs" style={{ width: 28, justifyContent: 'center', flexShrink: 0 }} onClick={() => pf(r.reqKey, Math.max(0, (projForm[r.reqKey] || 0) - 1))}>−</button>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18, minWidth: 28, textAlign: 'center' }}>{projForm[r.reqKey] || 0}</span>
                        <button type="button" className="btn btn-primary btn-xs" style={{ width: 28, justifyContent: 'center', flexShrink: 0 }} onClick={() => pf(r.reqKey, (projForm[r.reqKey] || 0) + 1)}>+</button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Honorario / turno</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" className="form-input" style={{ marginBottom: 0, fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} min={0} value={projForm[r.feeKey] || ''} onChange={e => pf(r.feeKey, Number(e.target.value))} />
                        <span style={{ fontSize: 11, color: 'var(--text-4)', flexShrink: 0 }}>CLP</span>
                      </div>
                      {projForm[r.feeKey] > 0 && <div style={{ fontSize: 11, color: 'var(--emerald)', marginTop: 3, textAlign: 'right', fontWeight: 700 }}>{fmtCLP(projForm[r.feeKey])}</div>}
                    </div>
                  </div>
                ))}
                {/* Total cost */}
                {ROLE_KEYS.some(r => (projForm[r.reqKey] || 0) > 0) && (
                  <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--navy-100)', borderRadius: 'var(--r)', border: '1px solid var(--navy-300)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-700)' }}>💰 Costo estimado turno completo</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--navy-700)' }}>
                      ${ROLE_KEYS.reduce((s, r) => s + (projForm[r.reqKey] || 0) * (projForm[r.feeKey] || 0), 0).toLocaleString('es-CL')} CLP
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1, justifyContent: 'center', padding: 13 }}>
                  {saving ? 'Guardando...' : projModal === 'new' ? '➕ Crear proyecto' : '💾 Guardar cambios'}
                </button>
                <button type="button" className="btn" onClick={() => { setProjModal(null); setError('') }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN WORKERS MODAL */}
      {assignProj && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 28, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: 'var(--sh-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>👥 Asignar profesionales</div>
                <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 3, fontWeight: 600 }}>{assignProj.name}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssignProj(null)}>✕</button>
            </div>

            {workers.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">Sin profesionales</div>
                <div className="empty-state-sub">Ve a Personal y agrega profesionales primero</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button className="btn btn-xs" onClick={() => setAssignSel(workers.map(w => w.id))}>✓ Todos</button>
                  <button className="btn btn-xs" onClick={() => setAssignSel([])}>✕ Ninguno</button>
                  <span style={{ fontSize: 12, color: 'var(--text-4)', alignSelf: 'center', marginLeft: 4 }}>{assignSel.length} seleccionado{assignSel.length !== 1 ? 's' : ''}</span>
                </div>
                {workers.map(w => {
                  const sel = assignSel.includes(w.id)
                  const feeMap = { 'Enfermera/o': 'fee_enfermera', 'TENS': 'fee_tens', 'Auxiliar de servicio': 'fee_auxiliar', 'Administrativo': 'fee_admin' }
                  const fee = assignProj[feeMap[w.role_label]] || 0
                  return (
                    <div key={w.id} onClick={() => setAssignSel(prev => prev.includes(w.id) ? prev.filter(x => x !== w.id) : [...prev, w.id])}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--r)', border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--navy-50)' : 'var(--surface)', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: sel ? 'var(--accent)' : 'var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                        {sel ? '✓' : ''}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{w.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                          {w.role_label || '—'}
                          {w.project && w.project !== assignProj.name && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>· hoy en {w.project}</span>}
                        </div>
                      </div>
                      {fee > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--emerald)', flexShrink: 0 }}>${fee.toLocaleString('es-CL')}</div>}
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={saveAssign} disabled={saving}>
                    {saving ? 'Guardando...' : `💾 Guardar (${assignSel.length} profesionales)`}
                  </button>
                  <button className="btn" onClick={() => setAssignProj(null)}>Cancelar</button>
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
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div className="card-title">💰 Tarifas globales por cargo</div>
              <div className="card-sub">Valores por defecto — se guardan en Supabase</div>
            </div>
            <button className="btn btn-sm" onClick={() => { setEditRates(v => !v); setRateForm({ ...rates }) }}>
              {editRates ? '✕ Cancelar' : '✏ Editar tarifas'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {Object.entries(editRates ? rateForm : rates).map(([role, fee]) => (
              <div key={role} style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '14px 16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{role}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>por turno</div>
                </div>
                {editRates ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" className="form-input" style={{ marginBottom: 0, width: 110, fontSize: 13, padding: '6px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} value={rateForm[role] || ''} onChange={e => setRateForm(prev => ({ ...prev, [role]: Number(e.target.value) }))} min={0} />
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>CLP</span>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--emerald)' }}>${Number(fee).toLocaleString('es-CL')} CLP</div>
                )}
              </div>
            ))}
          </div>
          {editRates && (
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveRates} disabled={saving}>
              {saving ? 'Guardando...' : '💾 Guardar tarifas en Supabase'}
            </button>
          )}
        </div>

        {/* Projects */}
        <div className="card-title" style={{ marginBottom: 10 }}>🏥 Proyectos / Licitaciones</div>
        {projects.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '40px 24px', border: '1px solid var(--border)' }}>
            <div className="empty-state-icon">🏥</div>
            <div className="empty-state-title">Sin proyectos creados</div>
            <div className="empty-state-sub">Crea tu primer proyecto con el botón "+ Crear proyecto"</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={openNew}>+ Crear proyecto</button>
          </div>
        ) : projects.map(p => {
          const pw   = projWorkers(p.name)
          const cost = totalCost(p)
          const activeDays = p.schedule ? Object.entries(p.schedule).filter(([, d]) => d.active) : []
          return (
            <div key={p.id} className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 4, background: p.active ? 'linear-gradient(90deg,var(--navy-500),var(--teal))' : 'var(--slate-300)' }} />
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{p.name}</div>
                      <span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>{p.active ? '● Activo' : '○ Inactivo'}</span>
                    </div>
                    {(p.hospital || p.location) && (
                      <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 4 }}>
                        {p.hospital && <span>🏥 {p.hospital}</span>}
                        {p.location && <span style={{ marginLeft: 10 }}>📍 {p.location}</span>}
                      </div>
                    )}
                    {/* Schedule chips */}
                    {activeDays.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                        {activeDays.map(([day, d]) => (
                          <span key={day} style={{ fontSize: 10, fontWeight: 700, background: 'var(--navy-100)', color: 'var(--navy-700)', borderRadius: 4, padding: '2px 7px' }}>
                            {DAY_LABELS[day].slice(0, 3)} {d.start}–{d.end}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button className="btn btn-xs btn-primary" onClick={() => openEditProj(p)}>✏ Editar</button>
                    <button className="btn btn-xs" onClick={() => toggleProj(p.id, p.active)}>{p.active ? '⏸' : '▶'}</button>
                    <button className="btn btn-xs btn-danger" onClick={() => deleteProj(p.id, p.name)}>🗑</button>
                  </div>
                </div>

                {/* Dotation */}
                {ROLE_KEYS.some(r => (p[r.reqKey] || 0) > 0) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {ROLE_KEYS.filter(r => (p[r.reqKey] || 0) > 0).map(r => {
                      const assigned = pw.filter(w => w.role_label === r.label).length
                      const needed   = p[r.reqKey] || 0
                      const ok       = assigned >= needed
                      return (
                        <div key={r.label} style={{ background: ok ? 'var(--emerald-l)' : 'var(--amber-l)', borderRadius: 'var(--r-sm)', padding: '6px 10px', border: `1px solid ${ok ? '#6ee7b7' : '#fde68a'}`, textAlign: 'center', minWidth: 80 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: ok ? 'var(--emerald-d)' : '#92400e' }}>{r.label.split('/')[0]}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14, color: ok ? 'var(--emerald-d)' : '#92400e' }}>{assigned}/{needed}</div>
                          <div style={{ fontSize: 10, color: ok ? 'var(--emerald-d)' : '#b45309' }}>${(p[r.feeKey] || 0).toLocaleString('es-CL')}</div>
                        </div>
                      )
                    })}
                    {cost > 0 && (
                      <div style={{ background: 'var(--navy-100)', borderRadius: 'var(--r-sm)', padding: '6px 10px', border: '1px solid var(--navy-300)', textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-700)' }}>COSTO</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 12, color: 'var(--navy-700)' }}>${cost.toLocaleString('es-CL')}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Workers + assign button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
                    {pw.length > 0 ? pw.map(w => (
                      <span key={w.id} style={{ fontSize: 11, fontWeight: 600, background: 'var(--navy-100)', color: 'var(--navy-700)', borderRadius: 20, padding: '3px 10px' }}>
                        {w.full_name?.split(' ').slice(0, 2).join(' ')} · {w.role_label?.split('/')[0] || w.role_label}
                      </span>
                    )) : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Sin profesionales asignados</span>}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => openAssign(p)}>
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
