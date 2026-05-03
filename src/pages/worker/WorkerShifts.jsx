import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function WorkerShifts() {
  const { user } = useAuth()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      supabase.from('shifts').select('*').eq('worker_id', user.id).order('shift_date', { ascending: false })
        .then(({ data }) => { setShifts(data || []); setLoading(false) })
    } else setLoading(false)
  }, [user])

  const MOCK = [
    { id:1, shift_date:'2025-05-15', start_time:'08:00', end_time:'20:00', project:'CardioHome Sur', checkin_time:'08:35', checkout_time:null, status:'late', fee:28000 },
    { id:2, shift_date:'2025-05-14', start_time:'08:00', end_time:'20:00', project:'CardioHome Sur', checkin_time:'08:01', checkout_time:'20:03', status:'completed', fee:28000 },
    { id:3, shift_date:'2025-05-13', start_time:'20:00', end_time:'08:00', project:'CardioHome Sur', checkin_time:'19:58', checkout_time:'08:02', status:'completed', fee:28000 },
    { id:4, shift_date:'2025-05-12', start_time:'08:00', end_time:'18:00', project:'Speech Centro', checkin_time:'08:18', checkout_time:'18:00', status:'late', fee:30000 },
    { id:5, shift_date:'2025-05-08', start_time:'08:00', end_time:'18:00', project:'Speech Centro', checkin_time:'08:22', checkout_time:'18:00', status:'late', fee:30000 },
  ]

  const rows = shifts.length ? shifts : MOCK
  const STATUS = {
    completed: { cls:'badge-green', label:'Completado' },
    late:      { cls:'badge-amber', label:'⚠ Con atraso' },
    scheduled: { cls:'badge-gray',  label:'Programado' },
    absent:    { cls:'badge-red',   label:'Inasistencia' },
  }

  const totalFees = rows.filter(s => s.status === 'completed' || s.status === 'late').reduce((a,b) => a+(b.fee||0), 0)

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Mis Turnos</div>
          <div className="topbar-sub">Mayo 2025</div>
        </div>
      </div>
      <div className="content">
        <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
          {[
            { label:'Completados', value:15, delta:'de 18 programados', accent:'accent-green', icon:'✔', ibg:'var(--emerald-l)', icl:'var(--emerald-d)' },
            { label:'Horas trabajadas', value:'180h', delta:'Mayo 2025', accent:'accent-blue', icon:'⏱', ibg:'var(--navy-200)', icl:'var(--navy-700)' },
            { label:'Honorarios', value:`$${(totalFees/1000).toFixed(0)}K`, delta:'CLP acumulado', accent:'accent-teal', icon:'💰', ibg:'var(--teal-l)', icl:'var(--teal)' },
            { label:'Atrasos', value:3, delta:'⚠ Supera límite mensual', accent:'accent-red', deltaClass:'neg', icon:'⚠', ibg:'var(--red-l)', icl:'var(--red)' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`}/>
              <div className="stat-icon" style={{background:s.ibg,color:s.icl,fontSize:16}}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{fontSize:s.value?.toString().length>4?20:undefined}}>{s.value}</div>
              <div className={`stat-delta ${s.deltaClass||''}`}>{s.delta}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Horario</th><th>Proyecto</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Honorario</th></tr>
              </thead>
              <tbody>
                {rows.map(s => {
                  const b = STATUS[s.status] || STATUS.scheduled
                  const isLate = s.status === 'late'
                  return (
                    <tr key={s.id} style={isLate ? {background:'#fffbeb'} : {}}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.shift_date}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.start_time}–{s.end_time}</td>
                      <td><span className="badge badge-blue">{s.project}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12,color:isLate?'var(--amber)':undefined,fontWeight:isLate?700:undefined}}>
                        {s.checkin_time || '—'}
                        {isLate && ' ⚠'}
                      </td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{s.checkout_time || '— en curso'}</td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td style={{fontWeight:800,fontFamily:'var(--font-mono)'}}>
                        ${(s.fee||0).toLocaleString('es-CL')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
