import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PROJECTS = ['CardioHome Sur', 'CardioHome Norte', 'Speech Centro', 'Speech Norte']
const ROLES    = ['Enfermera/o', 'TENS', 'Auxiliar de Enfermería', 'Kinesiólogo/a', 'Fonoaudiólogo/a', 'Psicólogo/a', 'Médico', 'Administrativo']

export default function InviteUser() {
  const [step, setStep]       = useState('list') // list | form | success
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [created, setCreated] = useState(null)
  const [search, setSearch]   = useState('')

  const [form, setForm] = useState({
    full_name:  '',
    email:      '',
    password:   '',
    role:       'worker',
    role_label: '',
    project:    '',
    phone:      '',
    rut:        '',
  })

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  function field(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function generatePassword() {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#'
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // 1. Create auth user via Supabase Admin signup
    // Since we only have anon key, we use signUp which auto-confirms if email confirm is off
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          role:      form.role,
        }
      }
    })

    if (authErr) {
      setError(authErr.message)
      setSaving(false)
      return
    }

    // 2. Update profile with all details
    // The trigger creates a basic profile on signup, we enrich it
    if (authData?.user?.id) {
      await supabase.from('profiles').upsert({
        id:         authData.user.id,
        email:      form.email,
        full_name:  form.full_name,
        role:       form.role,
        role_label: form.role_label,
        project:    form.project,
        phone:      form.phone,
        rut:        form.rut,
        status:     'active',
      })
    }

    setCreated({ ...form, id: authData?.user?.id })
    setStep('success')
    setSaving(false)
    loadUsers()
  }

  async function toggleStatus(id, current) {
    const next = current === 'active' ? 'inactive' : 'active'
    await supabase.from('profiles').update({ status: next }).eq('id', id)
    setUsers(u => u.map(x => x.id === id ? { ...x, status: next } : x))
  }

  async function deleteUser(id, name) {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return
    await supabase.from('profiles').delete().eq('id', id)
    setUsers(u => u.filter(x => x.id !== id))
  }

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.project?.toLowerCase().includes(search.toLowerCase())
  )

  const AVATAR_COLORS = [
    { bg: '#dbeafe', col: '#1e3a8a' },
    { bg: '#d1fae5', col: '#065f46' },
    { bg: '#fef9c3', col: '#92400e' },
    { bg: '#fce7f3', col: '#9d174d' },
    { bg: '#ede9fe', col: '#4c1d95' },
    { bg: '#cffafe', col: '#0e7490' },
  ]

  function Avatar({ name, idx, size = 36 }) {
    const c = AVATAR_COLORS[idx % AVATAR_COLORS.length]
    const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: c.bg, color: c.col,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.33, fontWeight: 700,
        fontFamily: 'var(--font-display)', flexShrink: 0,
      }}>{initials}</div>
    )
  }

  /* ── VIEWS ── */

  if (step === 'success' && created) return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Usuario creado</div>
          <div className="topbar-sub">Comparte las credenciales con el profesional</div>
        </div>
      </div>
      <div className="content">
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          {/* Success banner */}
          <div style={{
            background: 'linear-gradient(135deg, var(--navy-800), var(--navy-900))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--r-lg)',
            padding: '32px 28px',
            textAlign: 'center',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
              color: '#fff', letterSpacing: '-0.03em', marginBottom: 6,
            }}>¡Cuenta creada exitosamente!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {created.full_name} ya puede ingresar al sistema
            </div>
          </div>

          {/* Credentials card */}
          <div className="card" style={{ borderColor: 'var(--navy-300)', boxShadow: 'var(--sh-accent)' }}>
            <div className="card-title" style={{ marginBottom: 4 }}>🔑 Credenciales de acceso</div>
            <div className="card-sub" style={{ marginBottom: 20 }}>
              Comparte estos datos de forma segura con el profesional
            </div>

            {[
              ['👤 Nombre',        created.full_name],
              ['📧 Email',         created.email],
              ['🔒 Contraseña',    created.password],
              ['💼 Cargo',         created.role_label || '—'],
              ['🏥 Proyecto',      created.project    || '—'],
              ['📱 Teléfono',      created.phone      || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{label}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--text-1)',
                  fontFamily: label.includes('Contraseña') || label.includes('Email') ? 'var(--font-mono)' : undefined,
                  background: label.includes('Contraseña') ? 'var(--navy-100)' : undefined,
                  padding: label.includes('Contraseña') ? '3px 8px' : undefined,
                  borderRadius: label.includes('Contraseña') ? 6 : undefined,
                  letterSpacing: label.includes('Contraseña') ? '0.05em' : undefined,
                }}>{value}</span>
              </div>
            ))}

            <div className="alert alert-warn" style={{ marginTop: 16, marginBottom: 0 }}>
              <span className="alert-icon">⚠</span>
              <div className="alert-body">
                <div className="alert-msg">
                  Recuerda pedirle al profesional que <strong>cambie su contraseña</strong> en el primer inicio de sesión. 
                  No compartas estas credenciales por medios no seguros.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                const text = `HealthOps · Credenciales de acceso\n\nNombre: ${created.full_name}\nEmail: ${created.email}\nContraseña: ${created.password}\nURL: ${window.location.origin}\n\nPor favor cambia tu contraseña al ingresar.`
                navigator.clipboard?.writeText(text)
                alert('Credenciales copiadas al portapapeles ✓')
              }}
            >
              📋 Copiar credenciales
            </button>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStep('list'); setForm({ full_name:'', email:'', password:'', role:'worker', role_label:'', project:'', phone:'', rut:'' }) }}>
              + Crear otro usuario
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 'form') return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Nuevo usuario</div>
          <div className="topbar-sub">Crear cuenta de acceso al sistema</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={() => setStep('list')}>← Volver</button>
        </div>
      </div>
      <div className="content">
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          {error && (
            <div className="alert alert-crit" style={{ marginBottom: 16 }}>
              <span className="alert-icon">⚠</span>
              <div className="alert-body">
                <div className="alert-title">Error al crear usuario</div>
                <div className="alert-msg">{error}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Personal info */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>👤 Datos personales</div>
              <div className="card-sub" style={{ marginBottom: 18 }}>Información del profesional</div>

              <div className="g2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" required placeholder="Ej: María González Rojas"
                    value={form.full_name} onChange={e => field('full_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">RUT</label>
                  <input className="form-input" placeholder="12.345.678-9"
                    value={form.rut} onChange={e => field('rut', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" placeholder="+56 9 XXXX XXXX"
                    value={form.phone} onChange={e => field('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cargo / Especialidad *</label>
                  <select className="form-input" required value={form.role_label} onChange={e => field('role_label', e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proyecto asignado</label>
                  <select className="form-input" value={form.project} onChange={e => field('project', e.target.value)}>
                    <option value="">Sin asignar</option>
                    {PROJECTS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de cuenta</label>
                  <select className="form-input" value={form.role} onChange={e => field('role', e.target.value)}>
                    <option value="worker">Trabajador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Credentials */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>🔑 Credenciales de acceso</div>
              <div className="card-sub" style={{ marginBottom: 18 }}>
                El profesional usará estos datos para ingresar al sistema
              </div>

              <div className="g2" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Correo electrónico *</label>
                  <input className="form-input" type="email" required
                    placeholder="nombre@ejemplo.cl"
                    value={form.email} onChange={e => field('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña inicial *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" required
                      placeholder="Mín. 8 caracteres"
                      value={form.password} onChange={e => field('password', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn btn-sm" style={{ flexShrink: 0 }}
                      onClick={() => field('password', generatePassword())}
                      title="Generar contraseña segura">
                      🎲 Auto
                    </button>
                  </div>
                </div>
              </div>

              <div className="alert alert-info" style={{ marginBottom: 0 }}>
                <span className="alert-icon">💡</span>
                <div className="alert-body">
                  <div className="alert-msg">
                    Usa <strong>"🎲 Auto"</strong> para generar una contraseña segura automáticamente. 
                    Podrás copiarla al finalizar y compartirla con el profesional.
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            {form.full_name && (
              <div className="card" style={{ marginBottom: 14, borderStyle: 'dashed', background: 'var(--slate-50)' }}>
                <div className="card-sub" style={{ marginBottom: 12 }}>Vista previa del perfil</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar name={form.full_name} idx={0} size={48} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{form.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>
                      {form.role_label || 'Sin cargo'} · {form.project || 'Sin proyecto'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      {form.email || 'sin@email.cl'}
                    </div>
                  </div>
                  <span className={`badge ${form.role === 'admin' ? 'badge-blue' : 'badge-green'}`} style={{ marginLeft: 'auto' }}>
                    {form.role === 'admin' ? 'Admin' : 'Trabajador'}
                  </span>
                </div>
              </div>
            )}

            <button className="btn btn-primary"
              type="submit" disabled={saving}
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14 }}>
              {saving ? '⏳ Creando cuenta...' : '✓ Crear cuenta de acceso'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  /* ── LIST VIEW ── */
  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Usuarios del sistema</div>
          <div className="topbar-sub">{users.length} cuentas registradas</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setStep('form')}>
            + Crear nuevo usuario
          </button>
        </div>
      </div>

      <div className="content">
        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
          {[
            { label: 'Total usuarios', value: users.length, accent: 'accent-blue', icon: '👥', ibg: 'var(--navy-200)', icl: 'var(--navy-700)' },
            { label: 'Trabajadores', value: users.filter(u => u.role === 'worker').length, accent: 'accent-green', icon: '🏥', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)' },
            { label: 'Administradores', value: users.filter(u => u.role === 'admin').length, accent: 'accent-teal', icon: '⚙', ibg: 'var(--teal-l)', icl: 'var(--teal)' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.ibg, color: s.icl }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="card" style={{ marginBottom: 14, padding: '12px 18px' }}>
          <input className="form-input" style={{ marginBottom: 0 }}
            placeholder="🔍  Buscar por nombre, email o proyecto..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Users table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Cargo</th>
                  <th>Proyecto</th>
                  <th>Contacto</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}>
                    <div className="spinner" />
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon">👥</div>
                      <div className="empty-state-title">
                        {search ? 'No se encontraron usuarios' : 'Aún no hay usuarios'}
                      </div>
                      <div className="empty-state-sub">
                        {search ? 'Intenta con otro término de búsqueda' : 'Crea el primer usuario con el botón de arriba'}
                      </div>
                    </div>
                  </td></tr>
                ) : filtered.map((u, i) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={u.full_name} idx={i} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13 }}>{u.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>{u.role_label || '—'}</td>
                    <td>
                      {u.project
                        ? <span className="badge badge-blue">{u.project}</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                      {u.phone || '—'}
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                        {u.role === 'admin' ? '⚙ Admin' : '👤 Trabajador'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-green' : u.status === 'alert' ? 'badge-amber' : 'badge-red'}`}>
                        {u.status === 'active' ? '● Activo' : u.status === 'alert' ? '⚠ Alerta' : '○ Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-xs"
                          onClick={() => toggleStatus(u.id, u.status)}
                          title={u.status === 'active' ? 'Desactivar' : 'Activar'}>
                          {u.status === 'active' ? '⏸' : '▶'}
                        </button>
                        <button className="btn btn-danger btn-xs"
                          onClick={() => deleteUser(u.id, u.full_name)}
                          title="Eliminar usuario">
                          🗑
                        </button>
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
