import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['Enfermera/o', 'TENS', 'Auxiliar de servicio', 'Administrativo']
const COLORS = [
  { bg: '#dbeafe', col: '#1e3a8a' }, { bg: '#d1fae5', col: '#065f46' },
  { bg: '#fef9c3', col: '#92400e' }, { bg: '#fce7f3', col: '#9d174d' },
  { bg: '#ede9fe', col: '#4c1d95' }, { bg: '#cffafe', col: '#0e7490' },
]
const EMPTY = { full_name: '', email: '', rut: '', role_label: '', project: '', phone: '' }

function Avatar({ name, idx }) {
  const c = COLORS[idx % COLORS.length]
  const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
      {ini}
    </div>
  )
}

export default function Workers() {
  const [workers,  setWorkers]  = useState([])
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: w } = await supabase
      .from('profiles').select('*').eq('role', 'worker').order('full_name')
    setWorkers(w || [])

    // Load projects - try active first, then all
    const { data: p1, error: e1 } = await supabase
      .from('projects').select('id, name').eq('active', true).order('name')
    if (!e1 && p1 && p1.length > 0) {
      setProjects(p1)
    } else {
      const { data: p2 } = await supabase
        .from('projects').select('id, name').order('name')
      setProjects(p2 || [])
    }
    setLoading(false)
  }

  function f(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleAdd(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error: err } = await supabase.from('profiles')
      .insert([{ ...form, role: 'worker', status: 'active' }])
    if (err) setError(err.message)
    else { setShowAdd(false); setForm(EMPTY); loadData() }
    setSaving(false)
  }

  async function handleEdit(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error: err } = await supabase.from('profiles')
      .update({ full_name: form.full_name, email: form.email, rut: form.rut, role_label: form.role_label, project: form.project, phone: form.phone })
      .eq('id', editing.id)
    if (err) setError(err.message)
    else { setEditing(null); setForm(EMPTY); loadData() }
    setSaving(false)
  }

  async function quickProject(workerId, project) {
    await supabase.from('profiles').update({ project }).eq('id', workerId)
    setWorkers(w => w.map(x => x.id === workerId ? { ...x, project } : x))
  }

  async function toggleStatus(id, current) {
    const next = current === 'active' ? 'inactive' : 'active'
    await supabase.from('profiles').update({ status: next }).eq('id', id)
    setWorkers(w => w.map(x => x.id === id ? { ...x, status: next } : x))
  }

  function openEdit(w) {
    setEditing(w)
    setForm({ full_name: w.full_name || '', email: w.email || '', rut: w.rut || '', role_label: w.role_label || '', project: w.project || '', phone: w.phone || '' })
    setError('')
  }

  const filtered = workers.filter(w =>
    [w.full_name, w.project, w.role_label].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  )

  function FormFields() {
    return (
      <div className="g2" style={{ marginBottom: 0 }}>
        {error && <div style={{ gridColumn: '1/-1', background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r)', padding: '10px', fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>⚠ {error}</div>}
        <div className="form-group">
          <label className="form-label">Nombre completo *</label>
          <input className="form-input" required placeholder="María González" value={form.full_name} onChange={e => f('full_name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">RUT</label>
          <input className="form-input" placeholder="12.345.678-9" value={form.rut} onChange={e => f('rut', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Cargo *</label>
          <select className="form-input" required value={form.role_label} onChange={e => f('role_label', e.target.value)}>
            <option value="">Seleccionar...</option>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Proyecto</label>
          <select className="form-input" value={form.project} onChange={e => f('project', e.target.value)}>
            <option value="">Sin proyecto</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          {projects.length === 0 && <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>⚠ Crea proyectos primero en ⚙ Configuración</p>}
        </div>
        <div className="form-group">
          <label className="form-label">Correo</label>
          <input className="form-input" type="email" placeholder="correo@ejemplo.cl" value={form.email} onChange={e => f('email', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Teléfono</label>
          <input className="form-input" placeholder="+56 9 XXXX XXXX" value={form.phone} onChange={e => f('phone', e.target.value)} />
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter">

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Editar profesional</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Actualiza datos y proyecto</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setError('') }}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <FormFields />
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? 'Guardando...' : '💾 Guardar'}
                </button>
                <button type="button" className="btn" onClick={() => { setEditing(null); setError('') }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Personal</div>
          <div className="topbar-sub">{workers.length} profesionale{workers.length !== 1 ? 's' : ''} registrado{workers.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(v => !v); setError(''); setForm(EMPTY) }}>
            {showAdd ? '✕ Cancelar' : '+ Agregar profesional'}
          </button>
        </div>
      </div>

      <div className="content">
        {showAdd && (
          <div className="card" style={{ borderColor: 'var(--navy-300)', boxShadow: 'var(--sh-accent)', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Nuevo profesional</div>
            <form onSubmit={handleAdd}>
              <FormFields />
              <div className="alert alert-info" style={{ margin: '14px 0' }}>
                <span className="alert-icon">💡</span>
                <div className="alert-body"><div className="alert-msg">Para la cuenta de acceso ve a <strong>📬 Solicitudes acceso</strong> o <strong>🔑 Usuarios</strong>.</div></div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar profesional'}</button>
            </form>
          </div>
        )}

        {projects.length === 0 && !loading && (
          <div className="alert alert-warn" style={{ marginBottom: 14 }}>
            <span className="alert-icon">⚠</span>
            <div className="alert-body">
              <div className="alert-title">Sin proyectos creados</div>
              <div className="alert-msg">Ve a <strong>⚙ Configuración</strong> → crea proyectos y asigna profesionales.</div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '12px 18px', marginBottom: 14 }}>
          <input className="form-input" style={{ marginBottom: 0 }} placeholder="🔍  Buscar por nombre, cargo o proyecto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Cargo</th>
                  <th>Proyecto asignado</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">👥</div>
                      <div className="empty-state-title">{search ? 'Sin resultados' : 'Sin profesionales registrados'}</div>
                      <div className="empty-state-sub">{search ? 'Prueba otro término' : 'Agrega el primer profesional arriba'}</div>
                    </div>
                  </td></tr>
                ) : filtered.map((w, i) => (
                  <tr key={w.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={w.full_name} idx={i} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13 }}>{w.full_name || '—'}</div>
                          {w.rut && <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{w.rut}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{w.role_label || '—'}</span></td>
                    <td>
                      <select
                        value={w.project || ''}
                        onChange={e => quickProject(w.id, e.target.value)}
                        style={{ fontSize: 12, fontWeight: 600, border: '1.5px solid var(--border-2)', borderRadius: 'var(--r-sm)', padding: '5px 8px', background: w.project ? 'var(--navy-100)' : 'var(--slate-100)', color: w.project ? 'var(--navy-700)' : 'var(--text-4)', cursor: 'pointer', maxWidth: 180, fontFamily: 'var(--font-body)', outline: 'none' }}
                      >
                        <option value="">Sin proyecto</option>
                        {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{w.phone || w.email || '—'}</td>
                    <td>
                      <span className={`badge ${w.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {w.status === 'active' ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn btn-primary btn-xs" onClick={() => openEdit(w)}>✏ Editar</button>
                        <button className="btn btn-xs" onClick={() => toggleStatus(w.id, w.status)}>{w.status === 'active' ? '⏸' : '▶'}</button>
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
