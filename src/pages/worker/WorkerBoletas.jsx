import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const PAY_STATUS = {
  pending:    { cls: 'badge-amber', label: '⏳ Pendiente de pago',  color: '#d97706' },
  in_process: { cls: 'badge-blue',  label: '🔄 En proceso',         color: '#1d4ed8' },
  paid:       { cls: 'badge-green', label: '✅ Pago recibido',       color: '#059669' },
}

// ALWAYS full format: $250.000 CLP
function fmtCLP(n) {
  if (!n && n !== 0) return '$0 CLP'
  return `$${Number(n).toLocaleString('es-CL')} CLP`
}

export default function WorkerBoletas() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [shifts,   setShifts]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('resumen')

  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    const [{ data: pay }, { data: sh }] = await Promise.all([
      supabase.from('payments').select('*').eq('worker_id', user.id).order('period_year',{ascending:false}).order('period_month',{ascending:false}),
      supabase.from('shifts').select('*').eq('worker_id', user.id).in('status',['completed','late']).order('shift_date',{ascending:false}),
    ])
    setPayments(pay || [])
    setShifts(sh || [])
    setLoading(false)
  }

  // Group shifts by month
  const byMonth = shifts.reduce((acc, s) => {
    const d   = new Date(s.shift_date + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    if (!acc[key]) acc[key] = { month: d.getMonth()+1, year: d.getFullYear(), shifts: [], total: 0 }
    acc[key].shifts.push(s)
    acc[key].total += s.fee || 0
    return acc
  }, {})

  const thisKey   = `${currentYear}-${String(currentMonth).padStart(2,'0')}`
  const thisMonth = byMonth[thisKey] || { shifts: [], total: 0 }
  const totalPending = payments.filter(p=>p.status!=='paid').reduce((a,p)=>a+(p.amount||0),0)
  const totalPaid    = payments.filter(p=>p.status==='paid').reduce((a,p)=>a+(p.amount||0),0)

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <div className="spinner" style={{width:28,height:28}}/>
    </div>
  )

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mis Pagos</div>
          <div className="topbar-sub">Honorarios y estado de pagos</div>
        </div>
      </div>

      <div className="content">
        {/* Summary — FULL FORMAT */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
          {/* This month */}
          <div className="stat-card">
            <div className="stat-accent-bar accent-teal"/>
            <div className="stat-icon" style={{background:'var(--teal-l)',color:'var(--teal)'}}>💰</div>
            <div className="stat-label">Ganado este mes</div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:15,color:'var(--text-1)',lineHeight:1.1,marginTop:6}}>
              ${thisMonth.total.toLocaleString('es-CL')}
            </div>
            <div style={{fontSize:11,color:'var(--text-4)',marginTop:4}}>CLP · {thisMonth.shifts.length} turno{thisMonth.shifts.length!==1?'s':''}</div>
          </div>
          {/* Pending */}
          <div className="stat-card">
            <div className={`stat-accent-bar ${totalPending>0?'accent-amber':'accent-green'}`}/>
            <div className="stat-icon" style={{background:totalPending>0?'var(--amber-l)':'var(--emerald-l)',color:totalPending>0?'var(--amber)':'var(--emerald-d)'}}>⏳</div>
            <div className="stat-label">Pagos pendientes</div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:15,color:'var(--text-1)',lineHeight:1.1,marginTop:6}}>
              ${totalPending.toLocaleString('es-CL')}
            </div>
            <div style={{fontSize:11,color:totalPending>0?'var(--amber)':'var(--text-4)',marginTop:4,fontWeight:totalPending>0?700:400}}>
              {totalPending>0?'CLP por recibir':'✓ Sin pendientes'}
            </div>
          </div>
          {/* Paid */}
          <div className="stat-card">
            <div className="stat-accent-bar accent-green"/>
            <div className="stat-icon" style={{background:'var(--emerald-l)',color:'var(--emerald-d)'}}>✅</div>
            <div className="stat-label">Total recibido</div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:15,color:'var(--text-1)',lineHeight:1.1,marginTop:6}}>
              ${totalPaid.toLocaleString('es-CL')}
            </div>
            <div style={{fontSize:11,color:'var(--text-4)',marginTop:4}}>CLP histórico</div>
          </div>
        </div>

        <div className="tabs">
          {[['resumen','Resumen del mes'],['pagos','Mis pagos'],['turnos','Por turno']].map(([v,l])=>(
            <div key={v} className={`tab ${tab===v?'active':''}`} onClick={()=>setTab(v)}>{l}</div>
          ))}
        </div>

        {/* RESUMEN */}
        {tab==='resumen' && (
          <>
            <div className="card" style={{marginBottom:14}}>
              <div className="card-title" style={{marginBottom:4}}>{MONTHS[currentMonth]} {currentYear}</div>
              <div className="card-sub" style={{marginBottom:14}}>Honorarios del mes en curso</div>
              {/* Big amount */}
              <div style={{background:'linear-gradient(135deg,var(--navy-800),var(--navy-900))',borderRadius:'var(--r-md)',padding:'20px 22px',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700,marginBottom:6}}>Total ganado</div>
                  <div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:800,color:'#22c55e',letterSpacing:'-0.04em'}}>
                    ${thisMonth.total.toLocaleString('es-CL')}
                  </div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:4}}>CLP · {thisMonth.shifts.length} turno{thisMonth.shifts.length!==1?'s':''} completado{thisMonth.shifts.length!==1?'s':''}</div>
                </div>
                <div style={{fontSize:40}}>💰</div>
              </div>
              {thisMonth.shifts.length===0 ? (
                <div className="empty-state" style={{padding:'16px 0'}}><div className="empty-state-icon">📅</div><div className="empty-state-title">Sin turnos completados este mes</div></div>
              ) : thisMonth.shifts.map(s=>(
                <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{s.project||'—'}</div>
                    <div style={{fontSize:11,color:'var(--text-4)',fontFamily:'var(--font-mono)',marginTop:2}}>{s.shift_date} · {s.start_time}–{s.end_time}</div>
                  </div>
                  <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:13,color:'var(--emerald)',flexShrink:0}}>{fmtCLP(s.fee)}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title" style={{marginBottom:14}}>Historial por mes</div>
              {Object.entries(byMonth).length===0 ? (
                <div className="empty-state" style={{padding:'20px 0'}}><div className="empty-state-icon">📅</div><div className="empty-state-title">Sin historial aún</div></div>
              ) : Object.entries(byMonth).sort(([a],[b])=>b.localeCompare(a)).map(([key,data])=>(
                <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>{MONTHS[data.month]} {data.year}</div>
                    <div style={{fontSize:11,color:'var(--text-4)'}}>{data.shifts.length} turno{data.shifts.length!==1?'s':''}</div>
                  </div>
                  <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:14,color:'var(--emerald)'}}>{fmtCLP(data.total)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PAGOS */}
        {tab==='pagos' && (
          payments.length===0 ? (
            <div className="empty-state" style={{marginTop:40}}>
              <div className="empty-state-icon">💳</div>
              <div className="empty-state-title">Sin pagos asignados aún</div>
              <div className="empty-state-sub">La administración asignará tus pagos aquí</div>
            </div>
          ) : payments.map(p=>{
            const s = PAY_STATUS[p.status]||PAY_STATUS.pending
            return (
              <div key={p.id} className="card" style={{marginBottom:12,padding:0,overflow:'hidden'}}>
                <div style={{height:5,background:p.status==='paid'?'linear-gradient(90deg,#059669,#34d399)':p.status==='in_process'?'linear-gradient(90deg,#1d4ed8,#3b82f6)':'linear-gradient(90deg,#d97706,#fbbf24)'}}/>
                <div style={{padding:'18px 20px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
                    <div>
                      <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:700,marginBottom:4}}>{MONTHS[p.period_month]} {p.period_year}</div>
                      {p.description&&<div style={{fontSize:12,color:'var(--text-4)'}}>{p.description}</div>}
                    </div>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                  </div>
                  {/* BIG AMOUNT — ALWAYS FULL FORMAT */}
                  <div style={{background:p.status==='paid'?'var(--emerald-l)':p.status==='in_process'?'var(--navy-100)':'var(--amber-l)',borderRadius:'var(--r)',padding:'16px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:p.status==='paid'?'var(--emerald-d)':p.status==='in_process'?'var(--navy-700)':'#92400e',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>Monto del pago</div>
                      <div style={{fontFamily:'var(--font-display)',fontSize:24,fontWeight:800,color:p.status==='paid'?'var(--emerald-d)':p.status==='in_process'?'var(--navy-700)':'#92400e',letterSpacing:'-0.04em'}}>
                        ${p.amount.toLocaleString('es-CL')}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:p.status==='paid'?'var(--emerald-d)':p.status==='in_process'?'var(--navy-700)':'#92400e',marginTop:2}}>CLP</div>
                    </div>
                    <div style={{fontSize:36}}>{p.status==='paid'?'✅':p.status==='in_process'?'🔄':'⏳'}</div>
                  </div>
                  {p.paid_at&&<div style={{fontSize:11,color:'var(--text-4)',marginTop:10,fontFamily:'var(--font-mono)'}}>Pagado el: {new Date(p.paid_at).toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})}</div>}
                </div>
              </div>
            )
          })
        )}

        {/* TURNOS */}
        {tab==='turnos' && (
          <div className="card">
            <div className="card-title" style={{marginBottom:4}}>Detalle por turno</div>
            <div className="card-sub" style={{marginBottom:14}}>Todos los turnos completados con su valor</div>
            {shifts.length===0 ? (
              <div className="empty-state" style={{padding:'32px 0'}}><div className="empty-state-icon">📅</div><div className="empty-state-title">Sin turnos completados</div></div>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Fecha</th><th>Proyecto</th><th>Horario</th><th>Estado</th><th>Honorario</th></tr></thead>
                    <tbody>
                      {shifts.map(s=>(
                        <tr key={s.id}>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.shift_date}</td>
                          <td>{s.project?<span className="badge badge-blue">{s.project}</span>:'—'}</td>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.start_time}–{s.end_time}</td>
                          <td><span className={`badge ${s.status==='completed'?'badge-green':'badge-amber'}`}>{s.status==='completed'?'✓ Completado':'⚠ Con atraso'}</span></td>
                          <td style={{fontFamily:'var(--font-mono)',fontWeight:800,color:'var(--emerald)',fontSize:13,whiteSpace:'nowrap'}}>{fmtCLP(s.fee)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14,padding:'14px 16px',background:'var(--navy-50)',borderRadius:'var(--r)',border:'1px solid var(--navy-200)'}}>
                  <span style={{fontWeight:700,color:'var(--navy-700)'}}>Total histórico</span>
                  <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:16,color:'var(--emerald)'}}>
                    {fmtCLP(shifts.reduce((a,s)=>a+(s.fee||0),0))}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
