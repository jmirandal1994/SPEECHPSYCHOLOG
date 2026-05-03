import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Alerts() {
  const [critical, setCritical] = useState([])
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading]   = useState(true)

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const MONTHS     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('attendances')
      .select('worker_id, late_minutes, checked_in_at, profiles(full_name, role_label, project)')
      .eq('status', 'late')
      .gte('checked_in_at', monthStart)
      .order('checked_in_at', { ascending: false })

    // Group by worker
    const map = {}
    ;(data || []).forEach(a => {
      const id = a.worker_id
      if (!map[id]) map[id] = {
        name:     a.profiles?.full_name,
        role:     a.profiles?.role_label,
        project:  a.profiles?.project,
        count:    0,
        maxMins:  0,
        lastDate: a.checked_in_at?.slice(0, 10),
      }
      map[id].count++
      map[id].maxMins = Math.max(map[id].maxMins, a.late_minutes || 0)
    })

    const all = Object.values(map).sort((a, b) => b.count - a.count)
    setCritical(all.filter(w => w.count >= 2))
    setWarnings(all.filter(w => w.count === 1))
    setLoading(false)
  }

  const total = critical.length + warnings.length

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Gestión de Atrasos</div>
          <div className="topbar-sub">Control de puntualidad · {monthLabel}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm">📥 Exportar informe</button>
        </div>
      </div>

      <div className="content">
        {loading ? (
          <div className="empty-state" style={{ marginTop: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
        ) : total === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">Sin atrasos registrados en {monthLabel}</div>
            <div className="empty-state-sub">Los atrasos aparecerán aquí cuando los profesionales marquen entrada fuera del horario</div>
          </div>
        ) : (
          <>
            {critical.length > 0 && (
              <div className="alert alert-crit">
                <span className="alert-icon">🚨</span>
                <div className="alert-body">
                  <div className="alert-title">{critical.length} profesional{critical.length > 1 ? 'es superan' : ' supera'} el límite de 2 atrasos — acción obligatoria</div>
                  <div className="alert-msg">El sistema requiere revisión administrativa según protocolo interno.</div>
                </div>
              </div>
            )}

            {critical.length > 0 && (
              <>
                <div className="section-label">🔴 Críticos — 2 o más atrasos en {monthLabel}</div>
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Profesional</th><th>Proyecto</th><th>N° Atrasos</th><th>Último registro</th><th>Máx. minutos</th><th>Acciones</th></tr>
                      </thead>
                      <tbody>
                        {critical.map((w, i) => (
                          <tr key={i} style={{ background: '#fff5f5' }}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--red)' }}>{w.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{w.role}</div>
                            </td>
                            <td>{w.project ? <span className="badge badge-blue">{w.project}</span> : '—'}</td>
                            <td><span className="badge badge-red">⚠ {w.count} atrasos</span></td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{w.lastDate || '—'}</td>
                            <td style={{ fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                              {w.maxMins > 0 ? `+${w.maxMins} min` : '—'}
                            </td>
                            <td>
                              <button className="btn btn-danger btn-xs">Notificar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {warnings.length > 0 && (
              <>
                <div className="section-label">🟡 Advertencias — 1 atraso en {monthLabel}</div>
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Profesional</th><th>Proyecto</th><th>N° Atrasos</th><th>Fecha</th><th>Minutos</th></tr>
                      </thead>
                      <tbody>
                        {warnings.map((w, i) => (
                          <tr key={i} style={{ background: '#fffbeb' }}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{w.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{w.role}</div>
                            </td>
                            <td>{w.project ? <span className="badge badge-blue">{w.project}</span> : '—'}</td>
                            <td><span className="badge badge-amber">1 atraso</span></td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{w.lastDate || '—'}</td>
                            <td style={{ fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                              {w.maxMins > 0 ? `+${w.maxMins} min` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
