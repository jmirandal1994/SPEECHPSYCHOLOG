import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function WorkerHome() {
  const { profile } = useAuth()
  const [todayShift, setTodayShift] = useState(null)
  const [timer, setTimer] = useState(16093)

  useEffect(() => {
    const iv = setInterval(() => setTimer(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const h = String(Math.floor(timer/3600)).padStart(2,'0')
  const m = String(Math.floor((timer%3600)/60)).padStart(2,'0')
  const s = String(timer%60).padStart(2,'0')

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mi Panel</div>
          <div className="topbar-sub">Mayo 2025</div>
        </div>
      </div>
      <div className="content">
        {/* Welcome card */}
        <div className="card" style={{background:'linear-gradient(135deg,var(--navy-800),var(--navy-900))',border:'1px solid rgba(255,255,255,0.08)',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:700,color:'#fff',letterSpacing:'-0.03em',marginBottom:4}}>
                Buen día, {profile?.full_name?.split(' ')[0] || 'María'} 👋
              </div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>{profile?.role_label || 'Enfermera'} · {profile?.project || 'CardioHome Sur'}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:700,color:'#fff',letterSpacing:'-0.02em'}}>{h}:{m}:{s}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Tiempo en turno activo</div>
            </div>
          </div>
        </div>

        <div className="stats-grid" style={{gridTemplateColumns:'repeat(2,1fr)'}}>
          {[
            {label:'Turnos completados',value:15,delta:'de 18 programados',accent:'accent-green',icon:'✔',ibg:'var(--emerald-l)',icl:'var(--emerald-d)'},
            {label:'Horas trabajadas',value:'180h',delta:'Mayo 2025',accent:'accent-blue',icon:'⏱',ibg:'var(--navy-200)',icl:'var(--navy-700)'},
            {label:'Honorarios acumulados',value:'$420K',delta:'CLP Mayo 2025',accent:'accent-teal',icon:'💰',ibg:'var(--teal-l)',icl:'var(--teal)'},
            {label:'Atrasos del mes',value:3,delta:'⚠ Supera límite mensual',accent:'accent-red',deltaClass:'neg',icon:'⚠',ibg:'var(--red-l)',icl:'var(--red)'},
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`}/>
              <div className="stat-icon" style={{background:s.ibg,color:s.icl}}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{fontSize:s.value.toString().length>4?22:undefined}}>{s.value}</div>
              <div className={`stat-delta ${s.deltaClass||''}`}>{s.delta}</div>
            </div>
          ))}
        </div>

        {/* Today shift */}
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Turno de hoy</div><div className="card-sub">15 de mayo 2025</div></div>
            <span className="badge badge-live">● En curso</span>
          </div>
          <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
            {[['📅','Horario','08:00 – 20:00'],['🏥','Proyecto','CardioHome Sur'],['📍','Entrada','08:32 ✓'],['⏰','Tiempo restante','6h 45min']].map(([ic,l,v]) => (
              <div key={l} style={{flex:1,minWidth:120,padding:'14px 16px',background:'var(--slate-50)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                <div style={{fontSize:11,color:'var(--text-4)',marginBottom:4,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>{ic} {l}</div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:15,color:'var(--text-1)'}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
