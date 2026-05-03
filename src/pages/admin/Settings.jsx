export default function Settings() {
  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Configuración</div>
          <div className="topbar-sub">Ajustes del sistema HealthOps</div>
        </div>
      </div>
      <div className="content">
        <div className="g2">
          <div className="card">
            <div className="card-title" style={{marginBottom:16}}>Proyectos activos</div>
            {['CardioHome Sur','CardioHome Norte','Speech Centro','Speech Norte'].map(p => (
              <div key={p} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontWeight:600,fontSize:13}}>{p}</span>
                <span className="badge badge-green">Activo</span>
              </div>
            ))}
            <button className="btn btn-primary btn-sm" style={{marginTop:14}}>+ Agregar proyecto</button>
          </div>
          <div className="card">
            <div className="card-title" style={{marginBottom:16}}>Parámetros de atrasos</div>
            <div className="form-group">
              <label className="form-label">Límite de atrasos mensuales (alerta crítica)</label>
              <input className="form-input" type="number" defaultValue={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Tolerancia de puntualidad (minutos)</label>
              <input className="form-input" type="number" defaultValue={5} />
            </div>
            <div className="form-group">
              <label className="form-label">Anticipación mínima para inasistencias (horas)</label>
              <input className="form-input" type="number" defaultValue={24} />
            </div>
            <button className="btn btn-primary btn-sm">💾 Guardar cambios</button>
          </div>
        </div>
      </div>
    </div>
  )
}
