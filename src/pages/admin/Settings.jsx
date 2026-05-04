import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['Enfermera/o', 'TENS', 'Auxiliar de servicio', 'Administrativo']

export default function Settings() {
  const [projects,    setProjects]    = useState([])
  const [newProject,  setNewProject]  = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [tableExists, setTableExists] = useState(true)
  const [error,       setError]       = useState('')
  const [editingId,   setEditingId]   = useState(null)
  const [editName,    setEditName]    = useState('')

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    const { data, error } = await supabase.from('projects').select('*').order('name')
    if (error?.code === '42P01') {
      // Table doesn't exist yet
      setTableExists(false)
    } else {
      setProjects(data || [])
      setTableExists(true)
    }
    setLoading(false)
  }

  async function createTable() {
    // Guide user to run SQL
    setError('Debes ejecutar el SQL de la tabla projects en Supabase. Cópialo abajo.')
  }

  async function addProject(e) {
    e.preventDefault()
    if (!newProject.trim()) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('projects').insert([{ name: newProject.trim(), active: true }])
    if (error) {
      if (error.code === '23505') setError('Ya existe un proyecto con ese nombre.')
      else setError(error.message)
    } else {
      setNewProject('')
      loadProjects()
    }
    setSaving(false)
  }

  async function toggleProject(id, active) {
    await supabase.from('projects').update({ active: !active }).eq('id', id)
    setProjects(p => p.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  async function saveEdit(id) {
    if (!editName.trim()) return
    const { error } = await supabase.from('projects').update({ name: editName.trim() }).eq('id', id)
    if (!error) {
      setProjects(p => p.map(x => x.id === id ? { ...x, name: editName.trim() } : x))
      setEditingId(null)
    }
  }

  async function deleteProject(id, name) {
    if (!confirm(`¿Eliminar "${name}"? Los profesionales asignados a este proyecto quedarán sin proyecto.`)) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(p => p.filter(x => x.id !== id))
  }

  const SQL_TO_RUN = `-- Ejecuta esto en Supabase → SQL Editor
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_read" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "projects_write" ON public.projects FOR ALL USING (true);`

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

          {/* ── PROJECTS ── */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>🏥 Proyectos / Licitaciones</div>
            <div className="card-sub" style={{ marginBottom: 18 }}>
              Estos proyectos estarán disponibles al asignar turnos y personal.
            </div>

            {!tableExists ? (
              <div>
                <div className="alert alert-warn" style={{ marginBottom: 14 }}>
                  <span className="alert-icon">⚠</span>
                  <div className="alert-body">
                    <div className="alert-title">Tabla de proyectos no creada</div>
                    <div className="alert-msg">Debes ejecutar el siguiente SQL en Supabase para habilitar esta función.</div>
                  </div>
                </div>
                <div style={{ background: 'var(--slate-900)', borderRadius: 'var(--r)', padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', marginBottom: 14, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                  {SQL_TO_RUN}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { navigator.clipboard?.writeText(SQL_TO_RUN); alert('SQL copiado ✓ — Pégalo en Supabase → SQL Editor') }}>
                  📋 Copiar SQL
                </button>
                <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={loadProjects}>↻ Verificar</button>
              </div>
            ) : (
              <>
                {/* Add form */}
                <form onSubmit={addProject} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1, marginBottom: 0 }}
                    placeholder="Nombre del proyecto o licitación..."
                    value={newProject}
                    onChange={e => setNewProject(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={saving || !newProject.trim()}>
                    {saving ? '...' : '+ Agregar'}
                  </button>
                </form>

                {error && (
                  <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-l)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 12 }}>
                    ⚠ {error}
                  </div>
                )}

                {loading ? (
                  <div className="spinner" />
                ) : projects.length === 0 ? (
                  <div className="empty-state" style={{ padding: '28px 0' }}>
                    <div className="empty-state-icon">🏥</div>
                    <div className="empty-state-title">Sin proyectos aún</div>
                    <div className="empty-state-sub">Agrega tu primer proyecto arriba</div>
                  </div>
                ) : (
                  projects.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>🏥</span>

                      {editingId === p.id ? (
                        <input
                          className="form-input"
                          style={{ flex: 1, marginBottom: 0, fontSize: 13, padding: '6px 10px' }}
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') setEditingId(null) }}
                        />
                      ) : (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: p.active ? 'var(--text-1)' : 'var(--text-4)' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
                            {p.active ? '● Activo' : '○ Inactivo'}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {editingId === p.id ? (
                          <>
                            <button className="btn btn-success btn-xs" onClick={() => saveEdit(p.id)}>✓</button>
                            <button className="btn btn-xs" onClick={() => setEditingId(null)}>✕</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-xs" onClick={() => { setEditingId(p.id); setEditName(p.name) }}>✏</button>
                            <button className="btn btn-xs" onClick={() => toggleProject(p.id, p.active)}>
                              {p.active ? '⏸' : '▶'}
                            </button>
                            <button className="btn btn-danger btn-xs" onClick={() => deleteProject(p.id, p.name)}>🗑</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Company info */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 14 }}>🏢 Empresa</div>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" defaultValue="Speech Psychology & CardioHome" readOnly
                  style={{ background: 'var(--slate-50)', color: 'var(--text-3)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Cargos del sistema</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ROLES.map(r => <span key={r} className="badge badge-gray" style={{ fontSize: 11 }}>{r}</span>)}
                </div>
              </div>
            </div>

            {/* Late config */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 14 }}>⏰ Parámetros de atrasos</div>
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
              <button className="btn btn-primary btn-sm">💾 Guardar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
