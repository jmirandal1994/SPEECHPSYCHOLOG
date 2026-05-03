import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Alerts() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase
      .from('attendances')
      .select('*, profiles(full_name, role_label, project)')
      .eq('status', 'late')
      .order('checked_in_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  const MOCK_CRITICAL = [
    { id:1, profiles:{full_name:'Ana Pinto', role_label:'Enfermera', project:'CardioHome Sur'}, late_minutes:35, count:3, date:'15 mayo', shift:'08:00–20:00' },
    { id:2, profiles:{full_name:'Roberto Salinas', role_label:'TENS', project:'CardioHome Sur'}, late_minutes:22, count:3, date:'12 mayo', shift:'08:00–20:00' },
  ]
  const MOCK_WARN = [
    { id:3, profiles:{full_name:'Lucía Pérez', role_label:'Auxiliar', project:'CardioHome Norte'}, late_minutes:12, count:1, date:'10 mayo', shift:'08:00–20:00' },
    { id:4, profiles:{full_name:'Carlos Ramírez', role_label:'TENS', project:'Speech Norte'}, late_minutes:8, count:2, date:'8 mayo', shift:'08:00–18:00' },
  ]

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">⚠ Gestión de Atrasos</div>
          <div className="topbar-sub">Registro y control de incidencias de puntualidad</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm">📥 Exportar informe</button>
        </div>
      </div>

      <div className="content">
        <div className="alert alert-crit">
          <span className="alert-icon">🚨</span>
          <div className="alert-body">
            <div className="alert-title">2 profesionales superan el límite de 2 atrasos mensuales — acción obligatoria</div>
            <div className="alert-msg">El sistema requiere revisión administrativa y notificación formal según protocolo interno.</div>
          </div>
        </div>

        <div className="section-label">🔴 Críticos — Superan 2 atrasos este mes</div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Profesional</th><th>Proyecto</th><th>N° Atrasos</th><th>Último atraso</th><th>Minutos</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {MOCK_CRITICAL.map(a => (
                  <tr key={a.id} style={{background:'#fff5f5'}}>
                    <td>
                      <div style={{fontWeight:600,color:'var(--red)'}}>{a.profiles.full_name}</div>
                      <div style={{fontSize:11,color:'var(--text-4)'}}>{a.profiles.role_label}</div>
                    </td>
                    <td><span className="badge badge-blue">{a.profiles.project}</span></td>
                    <td><span className="badge badge-red" style={{fontSize:13}}>⚠ {a.count} atrasos</span></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{a.date} · {a.shift}</td>
                    <td style={{fontWeight:700,color:'var(--red)',fontFamily:'var(--font-mono)'}}>+{a.late_minutes} min</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-xs">📋 Ver historial</button>
                        <button className="btn btn-danger btn-xs">Notificar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-label">🟡 Advertencias — 1–2 atrasos este mes</div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Profesional</th><th>Proyecto</th><th>N° Atrasos</th><th>Último atraso</th><th>Minutos</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {MOCK_WARN.map(a => (
                  <tr key={a.id} style={{background:'#fffbeb'}}>
                    <td>
                      <div style={{fontWeight:600}}>{a.profiles.full_name}</div>
                      <div style={{fontSize:11,color:'var(--text-4)'}}>{a.profiles.role_label}</div>
                    </td>
                    <td><span className="badge badge-blue">{a.profiles.project}</span></td>
                    <td><span className="badge badge-amber">{a.count} atraso{a.count > 1 ? 's' : ''}</span></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{a.date} · {a.shift}</td>
                    <td style={{fontWeight:700,color:'var(--amber)',fontFamily:'var(--font-mono)'}}>+{a.late_minutes} min</td>
                    <td><button className="btn btn-xs">📋 Ver historial</button></td>
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
