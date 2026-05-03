import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Settings() {
  const [projects, setProjects]   = useState([])
  const [newProject, setNewProject] = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('name')
    setProjects(data || [])
    setLoading(false)
  }

  async function addProject(e) {
    e.preventDefault()
    if (!newProject.trim()) return
    setSaving(true)
    await supabase.from('projects').insert([{ name: newProject.trim(), active: true }])
    setNewProject('')
    loadProjects()
    setSaving(false)
  }

  async function toggleProject(id, active) {
    await supabase.from('projects').update({ active: !active }).eq('id', id)
    setProjects(p => p.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  async function deleteProject(id, name) {
    if (!confirm(`¿Eliminar el proyecto "${name}"?`)) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Configuración</div>
          <div className="topbar-sub">Speech Psychology & CardioHome</div>
        </div>
      </div>

      <div className="content">
        <div className="g2">
          {/* Projects */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>Proyectos / Licitaciones</div>
            <div className="card-sub" style={{ marginBottom: 18 }}>
              Agrega aquí tus proyectos. Estarán disponibles al asignar turnos y personal.
            </div>

            {/* Add project form */}
            <form onSubmit={addProject} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input
                className="form-input"
                style={{ flex: 1, marginBottom: 0 }}
                placeholder="Nombre del proyecto o licitación..."
                value={newProject}
                onChange={e => setNewProject(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !newProject.trim()}>
                {saving ? '...' : '+ Agregar'}
              </button>
            </form>

            {loading ? (
              <div className="spinner" />
            ) : projects.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-state-icon">🏥</div>
                <div className="empty-state-title">Sin proyectos aún</div>
                <div className="empty-state-sub">Agrega tu primer proyecto arriba</div>
              </div>
            ) : projects.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🏥</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: p.active ? 'var(--text-1)' : 'var(--text-4)' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>
                    {p.active ? '● Activo' : '○ Inactivo'}
                  </span>
                  <button className="btn btn-xs" onClick={() => toggleProject(p.id, p.active)}>
                    {p.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="btn btn-danger btn-xs" onClick={() => deleteProject(p.id, p.name)}>🗑</button>
                </div>
              </div>
            ))}
          </div>

          {/* System config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>Empresa</div>
              <div className="card-sub" style={{ marginBottom: 18 }}>Información de tu organización</div>
              <div className="form-group">
                <label className="form-label">Nombre de la empresa</label>
                <input className="form-input" defaultValue="Speech Psychology & CardioHome" readOnly style={{ background: 'var(--slate-50)', color: 'var(--text-3)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Cargos disponibles</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {['Enfermera/o', 'TENS', 'Auxiliar de servicio', 'Administrativo'].map(r => (
                    <span key={r} className="badge badge-gray" style={{ fontSize: 12 }}>{r}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>Parámetros de atrasos</div>
              <div className="card-sub" style={{ marginBottom: 18 }}>Define los umbrales del sistema</div>
              <div className="form-group">
                <label className="form-label">Límite mensual (alerta crítica)</label>
                <input className="form-input" type="number" defaultValue={2} min={1} />
              </div>
              <div className="form-group">
                <label className="form-label">Tolerancia de puntualidad (minutos)</label>
                <input className="form-input" type="number" defaultValue={5} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Anticipación mínima inasistencias (horas)</label>
                <input className="form-input" type="number" defaultValue={24} min={0} />
              </div>
              <button className="btn btn-primary btn-sm">💾 Guardar cambios</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
