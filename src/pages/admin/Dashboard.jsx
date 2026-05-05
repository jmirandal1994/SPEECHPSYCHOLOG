import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORS  = [{ bg:'#dbeafe',col:'#1e3a8a' },{ bg:'#d1fae5',col:'#065f46' },{ bg:'#fef9c3',col:'#92400e' },{ bg:'#fce7f3',col:'#9d174d' },{ bg:'#ede9fe',col:'#4c1d95' },{ bg:'#cffafe',col:'#0e7490' }]

function fmtCLP(n) { return n > 0 ? `$${Number(n).toLocaleString('es-CL')} CLP` : '$0 CLP' }
function fmtTime(ts) { return ts ? new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}) : '—' }

export default function Dashboard() {
  const navigate = useNavigate()

  const [stats,    setStats]    = useState({ workers:0, shifts:0, late:0, fees:0, pending:0 })
  const [activity, setActivity] = useState([])
  const [requests, setRequests] = useState([])
  const [critical, setCritical] = useState([])
  const [loading,  setLoading]  = useState(true)

  const now        = new Date()
  const todayStr   = now.toISOString().slice(0, 10)
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  useEffect(() => {
    loadData()
    // Real-time attendance updates
    const ch = supabase.channel('dashboard_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function loadData() {
    setLoading(true)
    const [
      { count: workerCount },
      { count: shiftCount },
      { count: lateCount },
      { data: actData },
      { data: reqData },
      { data: boletaData },
    ] = await Promise.all([
      supabase.from('profiles').select('*',{count:'exact',head:true}).eq('role','worker').eq('status','active'),
      supabase.from('shifts').select('*',{count:'exact',head:true}).in('status',['completed','late']).gte('shift_date',monthStart),
      supabase.from('attendances').select('*',{count:'exact',head:true}).eq('status','late').gte('checked_in_at',monthStart),
      supabase.from('attendances').select('*, profiles(full_name, role_label, project)').gte('checked_in_at',todayStr+'T00:00:00').order('checked_in_at',{ascending:false}).limit(10),
      supabase.from('requests').select('*, profiles(full_name)').eq('status','pending').order('created_at',{ascending:false}).limit(5),
      supabase.from('payments').select('amount').neq('status','paid'),
    ])

    const totalPending = (boletaData||[]).reduce((a,p)=>a+(p.amount||0),0)

    setStats({ workers: workerCount||0, shifts: shiftCount||0, late: lateCount||0, fees: 0, pending: totalPending })
    setActivity(actData||[])
    setRequests(reqData||[])

    // Critical alerts: 2+ lates
    if ((lateCount||0) > 0) {
      const { data: lw } = await supabase
        .from('attendances').select('worker_id, profiles(full_name)')
        .eq('status','late').gte('checked_in_at',monthStart)
      const counts = {}
      ;(lw||[]).forEach(a => {
        if (!counts[a.worker_id]) counts[a.worker_id] = { name: a.profiles?.full_name, count: 0 }
        counts[a.worker_id].count++
      })
      setCritical(Object.values(counts).filter(w => w.count >= 2))
    } else setCritical([])

    setLoading(false)
  }

  async function handleRequest(id, action) {
    await supabase.from('requests').update({ status: action === 'approve' ? 'approved' : 'rejected' }).eq('id', id)
    setRequests(r => r.filter(x => x.id !== id))
  }

  const ini = name => (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  const TYPE_ICON  = { inasistencia:'📋', reclamo:'⚠', cambio:'🔄' }
  const TYPE_LABEL = { inasistencia:'Inasistencia', reclamo:'Reclamo', cambio:'Cambio' }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-sub">Resumen operacional · {monthLabel}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={loadData}>↻</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/shifts')}>+ Nuevo turno</button>
        </div>
      </div>

      <div className="content">
        {/* Critical alert */}
        {critical.length > 0 && (
          <div className="alert alert-crit" style={{ marginBottom: 16 }}>
            <span className="alert-icon">🚨</span>
            <div className="alert-body">
              <div className="alert-title">{critical.length} profesional{critical.length>1?'es superan':'supera'} el límite de atrasos mensual</div>
              <div className="alert-msg">{critical.map(w=>w.name).join(', ')} — {monthLabel}</div>
              <div className="alert-actions">
                <button className="btn btn-danger btn-xs" onClick={() => navigate('/alerts')}>Ver detalle →</button>
              </div>
            </div>
          </div>
        )}

        {/* KPI Stats */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {[
            { label:'Personal activo',    value:loading?'—':stats.workers, accent:'accent-blue',  icon:'👥', ibg:'var(--navy-200)',   icl:'var(--navy-700)',   delta:'Profesionales activos',                    onClick:()=>navigate('/workers') },
            { label:'Turnos completados', value:loading?'—':stats.shifts,  accent:'accent-green', icon:'✔',  ibg:'var(--emerald-l)', icl:'var(--emerald-d)', delta:monthLabel,                                   onClick:()=>navigate('/shifts') },
            { label:'Atrasos en el mes',  value:loading?'—':stats.late,    accent:stats.late>0?'accent-amber':'accent-green', icon:'⏰', ibg:stats.late>0?'var(--amber-l)':'var(--emerald-l)', icl:stats.late>0?'var(--amber)':'var(--emerald-d)', delta:stats.late===0?'✓ Sin atrasos':`${stats.late} incidencia${stats.late>1?'s':''}`, deltaClass:stats.late>0?'warn':'', onClick:()=>navigate('/alerts') },
            { label:'Pagos pendientes',   value:loading?'—':fmtCLP(stats.pending), accent:'accent-teal',  icon:'💰', ibg:'var(--teal-l)',    icl:'var(--teal)',       delta:'CLP por pagar',                             onClick:()=>navigate('/boletas') },
          ].map(s => (
            <div className="stat-card" key={s.label} onClick={s.onClick} style={{ cursor:'pointer' }}>
              <div className={`stat-accent-bar ${s.accent}`}/>
              <div className="stat-icon" style={{ background:s.ibg, color:s.icl }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:typeof s.value==='string'&&s.value.length>6?15:28, color:'var(--text-1)', lineHeight:1.1, marginTop:6 }}>{s.value}</div>
              <div className={`stat-delta ${s.deltaClass||''}`} style={{ marginTop:6 }}>{s.delta}</div>
            </div>
          ))}
        </div>

        <div className="g13">
          {/* Today's activity — real check-ins */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Actividad de hoy</div>
                <div className="card-sub">Registros de entrada/salida en tiempo real</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="badge badge-live">● En vivo</span>
                <button className="btn btn-xs" onClick={() => navigate('/geo')}>📍 Ver mapa</button>
              </div>
            </div>

            {loading ? (
              <div className="empty-state"><div className="spinner"/></div>
            ) : activity.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">Sin registros hoy</div>
                <div className="empty-state-sub">Los marcajes aparecerán aquí en tiempo real</div>
              </div>
            ) : activity.map((a, i) => {
              const c = COLORS[i%COLORS.length]
              const isLate = a.status === 'late'
              const hasOut = !!a.checked_out_at
              return (
                <div key={a.id} className="worker-row"
                  style={isLate ? { background:'#fff5f5', borderRadius:8, padding:'10px 10px', border:'1px solid #fca5a5', margin:'4px -10px' } : {}}>
                  <div className="worker-avatar" style={{ background:c.bg, color:c.col }}>{ini(a.profiles?.full_name)}</div>
                  <div className="worker-info">
                    <div className="worker-name" style={{ color:isLate?'var(--red)':undefined }}>{a.profiles?.full_name||'—'}</div>
                    <div className="worker-role">{a.profiles?.role_label}{a.profiles?.project?` · ${a.profiles.project}`:''}</div>
                  </div>
                  {/* Entry and exit times */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'var(--emerald)' }}>↑ {fmtTime(a.checked_in_at)}</div>
                    {hasOut
                      ? <div style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'#6366f1' }}>↓ {fmtTime(a.checked_out_at)}</div>
                      : <div style={{ fontSize:11, color:'var(--text-4)' }}>En turno</div>}
                  </div>
                  <span className={`badge ${isLate?'badge-red':'badge-green'}`} style={{ flexShrink:0 }}>
                    {isLate ? '⚠ Tarde' : hasOut ? '✓ Completo' : '● Activo'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Right column */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Pending requests */}
            <div className="card" style={{ marginBottom:0 }}>
              <div className="card-header" style={{ marginBottom:14 }}>
                <div className="card-title">Solicitudes pendientes</div>
                {requests.length > 0 && <span className="badge badge-red">{requests.length}</span>}
              </div>
              {loading ? (
                <div className="empty-state" style={{ padding:'16px 0' }}><div className="spinner"/></div>
              ) : requests.length === 0 ? (
                <div className="empty-state" style={{ padding:'20px 0' }}>
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title" style={{ fontSize:13 }}>Todo al día</div>
                </div>
              ) : requests.map(r => (
                <div className="notif-row" key={r.id}>
                  <div className="notif-icon" style={{ background:r.type==='reclamo'?'var(--red-l)':r.type==='cambio'?'var(--navy-200)':'var(--amber-l)' }}>
                    {TYPE_ICON[r.type]||'📋'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="notif-title">{TYPE_LABEL[r.type]||r.type} · {r.profiles?.full_name}</div>
                    <div className="notif-sub">{r.created_at?.slice(0,10)}</div>
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-success btn-xs" onClick={() => handleRequest(r.id,'approve')}>✓</button>
                    <button className="btn btn-danger btn-xs" onClick={() => handleRequest(r.id,'reject')}>✗</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="card" style={{ marginBottom:0 }}>
              <div className="card-title" style={{ marginBottom:14 }}>Acciones rápidas</div>
              {[
                { icon:'👥', label:'Agregar profesional',   sub:'Crear cuenta de trabajador',      path:'/users' },
                { icon:'📅', label:'Programar turno',       sub:'Asignar turno con honorario',      path:'/shifts' },
                { icon:'📍', label:'Ver geolocalización',   sub:'Mapa de asistencia en tiempo real', path:'/geo' },
                { icon:'💰', label:'Gestionar pagos',       sub:'Honorarios y pagos pendientes',    path:'/boletas' },
              ].map(a => (
                <div key={a.path} className="notif-row" style={{ cursor:'pointer' }} onClick={() => navigate(a.path)}>
                  <div className="notif-icon" style={{ background:'var(--slate-100)', fontSize:18 }}>{a.icon}</div>
                  <div><div className="notif-title">{a.label}</div><div className="notif-sub">{a.sub}</div></div>
                  <span style={{ color:'var(--text-4)', fontSize:18 }}>›</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
