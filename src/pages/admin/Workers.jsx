import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES    = ['Enfermera/o', 'TENS', 'Auxiliar de servicio', 'Administrativo']
const COLORS   = [
  { bg: '#dbeafe', col: '#1e3a8a' }, { bg: '#d1fae5', col: '#065f46' },
  { bg: '#fef9c3', col: '#92400e' }, { bg: '#fce7f3', col: '#9d174d' },
  { bg: '#ede9fe', col: '#4c1d95' }, { bg: '#cffafe', col: '#0e7490' },
]

export default function Workers() {
  const [workers, setWorkers]   = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ full_name: '', email: '', rut: '', role_label: '', project: '', phone: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: w }, { data: p }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'worker').order('full_name'),
      supabase.from('projects').select('*').eq('active', true).order('name'),
    ])
    setWorkers(w || [])
    setProjects(p || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').insert([{
      ...form, role: 'worker', status: 'active',
    }])
    if (!error) {
      setShowForm(false)
      setForm({ full_name: '', email: '', rut: '', role_label: '', project: '', phone: '' })
      loadData()
    }
    setSaving(false)
  }

  async function toggleStatus(id, current) {
    const next = current === 'active' ? 'inactive' : 'active'
    await supabase.from('profiles').update({ status: next }).eq('id', id)
    setWorkers(w => w.map(x => x.id === id ? { ...x, status: next } : x))
  }

  const filtered = workers.filter(w =>
    (w.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.project   || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.role_label|| '').toLowerCase().includes(search.toLowerCase())
  )

  function Avatar({ name, idx }) {
    const c = COLORS[idx % COLORS.length]
    const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    return (
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0 }}>
        {ini}
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Personal</div>
          <div className="topbar-sub">{workers.length} profesionale{workers.length !== 1 ? 's' : ''} registrado{workers.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancelar' : '+ Agregar profesional'}
          </button>
        </div>
      </div>

      <div className="content">
        {/* Add form */}
        {showForm && (
          <div className="card" style={{ borderColor: 'var(--navy-300)', boxShadow: 'var(--sh-accent)', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 18 }}>Nuevo profesional</div>
            <form onSubmit={handleCreate}>
              <div className="g2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" required placeholder="Ej: María González" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">RUT</label>
                  <input className="form-input" placeholder="12.345.678-9" value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cargo *</label>
                  <select className="form-input" required value={form.role_label} onChange={e => setForm(f => ({ ...f, role_label: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proyecto</label>
                  <select className="form-input" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {projects.map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Correo</label>
                  <input className="form-input" type="email" placeholder="correo@ejemplo.cl" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" placeholder="+56 9 XXXX XXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                <span className="alert-icon">💡</span>
                <div className="alert-body"><div className="alert-msg">Para crear la cuenta de acceso al sistema ve a <strong>🔑 Usuarios</strong>.</div></div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : '💾 Guardar profesional'}
              </button>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="card" style={{ padding: '12px 18px', marginBottom: 14 }}>
          <input className="form-input" style={{ marginBottom: 0 }}
            placeholder="🔍  Buscar por nombre, cargo o proyecto..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Cargo</th>
                  <th>Proyecto</th>
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
                      <div className="empty-state-title">{search ? 'Sin resultados' : 'Aún no hay profesionales'}</div>
                      <div className="empty-state-sub">
                        {search ? 'Prueba con otro término' : 'Agrega el primer profesional con el botón de arriba'}
                      </div>
                    </div>
                  </td></tr>
                ) : filtered.map((w, i) => (
                  <tr key={w.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={w.full_name} idx={i} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{w.full_name}</div>
                          {w.rut && <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{w.rut}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{w.role_label || '—'}</td>
                    <td>
                      {w.project
                        ? <span className="badge badge-blue">{w.project}</span>
                        : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>Sin proyecto</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                      {w.phone || w.email || '—'}
                    </td>
                    <td>
                      <span className={`badge ${w.status === 'active' ? 'badge-green' : w.status === 'alert' ? 'badge-amber' : 'badge-red'}`}>
                        {w.status === 'active' ? '● Activo' : w.status === 'alert' ? '⚠ Alerta' : '○ Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-xs" onClick={() => toggleStatus(w.id, w.status)}>
                        {w.status === 'active' ? '⏸ Desactivar' : '▶ Activar'}
                      </button>
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
