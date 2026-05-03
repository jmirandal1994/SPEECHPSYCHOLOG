import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const COLORS = [
  { bg: '#dbeafe', col: '#1e3a8a' }, { bg: '#d1fae5', col: '#065f46' },
  { bg: '#fef9c3', col: '#92400e' }, { bg: '#fce7f3', col: '#9d174d' },
  { bg: '#ede9fe', col: '#4c1d95' }, { bg: '#cffafe', col: '#0e7490' },
]

export default function Workers() {
  const [workers, setWorkers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ full_name: '', email: '', role_label: '', project: '', phone: '' })
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')

  useEffect(() => { loadWorkers() }, [])

  async function loadWorkers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'worker')
      .order('full_name')
    setWorkers(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    // Create auth user first via admin API is not possible with anon key.
    // Instead we insert directly into profiles (user must self-register first).
    // For demo, we insert a placeholder profile.
    const { error } = await supabase.from('profiles').insert([{
      ...form,
      role: 'worker',
      status: 'active',
    }])
    if (!error) { setShowForm(false); setForm({ full_name:'', email:'', role_label:'', project:'', phone:'' }); loadWorkers() }
    setSaving(false)
  }

  const filtered = workers.filter(w =>
    w.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.project?.toLowerCase().includes(search.toLowerCase())
  )

  function avatar(name, idx) {
    const c = COLORS[idx % COLORS.length]
    const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    return <div className="worker-avatar" style={{ background: c.bg, color: c.col }}>{initials}</div>
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Personal</div>
          <div className="topbar-sub">{workers.length} profesionales registrados</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm">📥 Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Agregar profesional</button>
        </div>
      </div>

      <div className="content">
        {/* Search */}
        <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
          <input
            className="form-input"
            placeholder="🔍  Buscar por nombre o proyecto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Add form */}
        {showForm && (
          <div className="card" style={{ borderColor: 'var(--navy-300)', boxShadow: 'var(--sh-accent)' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Nuevo profesional</div>
                <div className="card-sub">Completa los datos del trabajador</div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowForm(false)}>✕ Cancelar</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="g2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo electrónico *</label>
                  <input className="form-input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cargo / Especialidad</label>
                  <input className="form-input" placeholder="Ej: Enfermera, TENS, Auxiliar" value={form.role_label} onChange={e => setForm(f => ({ ...f, role_label: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Proyecto asignado</label>
                  <select className="form-input" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    <option>CardioHome Sur</option>
                    <option>CardioHome Norte</option>
                    <option>Speech Centro</option>
                    <option>Speech Norte</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" placeholder="+56 9 XXXX XXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : '💾 Guardar profesional'}
              </button>
            </form>
          </div>
        )}

        {/* Workers table */}
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
                  <tr><td colSpan={6} style={{ textAlign:'center', padding: 32 }}><div className="spinner" /></td></tr>
                ) : filtered.length === 0 ? (
                  /* Mock data while DB empty */
                  [
                    { id:1, full_name:'María González', role_label:'Enfermera', project:'CardioHome Sur', phone:'+56 9 8765 4321', status:'active' },
                    { id:2, full_name:'Carlos Ramírez', role_label:'TENS', project:'Speech Norte', phone:'+56 9 7654 3210', status:'active' },
                    { id:3, full_name:'Lucía Pérez', role_label:'Auxiliar', project:'CardioHome Norte', phone:'+56 9 6543 2109', status:'active' },
                    { id:4, full_name:'Ana Pinto', role_label:'Enfermera', project:'CardioHome Sur', phone:'+56 9 5432 1098', status:'alert' },
                    { id:5, full_name:'José Vargas', role_label:'TENS', project:'CardioHome Sur', phone:'+56 9 4321 0987', status:'active' },
                    { id:6, full_name:'Roberto Salinas', role_label:'TENS', project:'CardioHome Sur', phone:'+56 9 3210 9876', status:'active' },
                  ].map((w, i) => (
                    <tr key={w.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {avatar(w.full_name, i)}
                          <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{w.full_name}</span>
                        </div>
                      </td>
                      <td>{w.role_label}</td>
                      <td><span className="badge badge-blue">{w.project}</span></td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{w.phone}</td>
                      <td><span className={`badge ${w.status === 'active' ? 'badge-green' : 'badge-red'}`}>{w.status === 'active' ? 'Activo' : '⚠ Alerta'}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-xs">Ver</button>
                          <button className="btn btn-xs">✏</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  filtered.map((w, i) => (
                    <tr key={w.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {avatar(w.full_name, i)}
                          <span style={{ fontWeight:600, color:'var(--text-1)' }}>{w.full_name}</span>
                        </div>
                      </td>
                      <td>{w.role_label}</td>
                      <td><span className="badge badge-blue">{w.project}</span></td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{w.phone}</td>
                      <td><span className={`badge ${w.status === 'active' ? 'badge-green' : 'badge-red'}`}>{w.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-xs">Ver</button>
                          <button className="btn btn-xs">✏</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
