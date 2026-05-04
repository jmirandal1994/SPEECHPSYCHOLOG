import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const MONTHS_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MARKER_COLORS = ['#1d4ed8','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d']

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})
}
function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str+'T12:00:00')
  const days=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  return `${days[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`
}

export default function GeoMonitor() {
  const mapContainerRef = useRef(null)
  const mapRef          = useRef(null)   // leaflet map instance
  const markersRef      = useRef([])

  const [records,    setRecords]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [leafletReady, setLeafletReady] = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [dateMode,   setDateMode]   = useState('today')
  const [customDate, setCustomDate] = useState('')
  const [projFilter, setProjFilter] = useState('all')
  const [workerFilter, setWorkerFilter] = useState('all')

  const today = new Date().toISOString().slice(0,10)
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10)
  const week7 = new Date(Date.now()-7*86400000).toISOString().slice(0,10)

  const queryFrom = dateMode==='today'?today : dateMode==='yesterday'?yesterday : dateMode==='week'?week7 : customDate||today

  // Step 1: Load Leaflet JS/CSS
  useEffect(() => {
    function onLoad() { setLeafletReady(true) }

    if (window.L) { setLeafletReady(true); return }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id='leaflet-css'; link.rel='stylesheet'
      link.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script')
      script.id='leaflet-js'
      script.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
      script.onload = onLoad
      document.head.appendChild(script)
    } else {
      // Script tag exists, wait for it
      const check = setInterval(()=>{ if(window.L){clearInterval(check);onLoad()} },100)
    }
  }, [])

  // Step 2: Init map once Leaflet is ready AND container exists
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapRef.current) return
    const L = window.L
    const map = L.map(mapContainerRef.current, { zoomControl: true, attributionControl: true })
      .setView([-33.45, -70.65], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom:19,
    }).addTo(map)
    mapRef.current = map
    // Force size recalculation
    setTimeout(()=>map.invalidateSize(),300)
  }, [leafletReady])

  // Step 3: Load data when filters change
  useEffect(() => { loadData() }, [queryFrom])

  async function loadData() {
    setLoading(true)
    setSelected(null)
    const endDate = dateMode==='week' ? today : queryFrom
    const { data } = await supabase
      .from('attendances')
      .select('*, profiles(full_name,role_label,project)')
      .gte('checked_in_at', queryFrom+'T00:00:00')
      .lte('checked_in_at', endDate+'T23:59:59')
      .order('checked_in_at',{ascending:false})
    setRecords(data||[])
    setLoading(false)
  }

  // Step 4: Draw markers when records change
  useEffect(() => {
    if (!mapRef.current || !window.L || loading) return
    drawMarkers()
  }, [records, selected, loading])

  function drawMarkers() {
    const L=window.L, map=mapRef.current
    if(!L||!map) return

    // Clear old markers
    markersRef.current.forEach(m=>{ try{map.removeLayer(m)}catch(_){} })
    markersRef.current=[]

    const filtered = getFiltered()
    if(filtered.length===0) return

    // Assign colors by worker
    const workerColor={}
    const uids=[...new Set(filtered.map(r=>r.worker_id))]
    uids.forEach((id,i)=>{ workerColor[id]=MARKER_COLORS[i%MARKER_COLORS.length] })

    const bounds=[]

    filtered.forEach(r=>{
      if(!r.checkin_lat||!r.checkin_lng) return
      const color=workerColor[r.worker_id]||'#1d4ed8'
      const isSel=r.id===selected
      const name=r.profiles?.full_name||'—'
      const ini=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

      const icon=L.divIcon({
        html:`<div style="
          position:relative;display:flex;flex-direction:column;align-items:center;
        "><div style="
          width:${isSel?46:38}px;height:${isSel?46:38}px;border-radius:50%;
          background:${color};
          border:${isSel?'3px solid #fff':'2px solid rgba(255,255,255,0.85)'};
          box-shadow:0 3px 14px rgba(0,0,0,0.4)${isSel?',0 0 0 4px '+color+'66':''},
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:800;color:#fff;font-family:system-ui;
          cursor:pointer;
        ">${ini}</div>
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;border-right:6px solid transparent;
          border-top:9px solid ${color};margin-top:-1px;
        "></div></div>`,
        className:'',
        iconSize:[isSel?46:38, isSel?56:48],
        iconAnchor:[isSel?23:19, isSel?56:48],
      })

      const popup=`<div style="font-family:system-ui;min-width:210px;padding:2px 0">
        <div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:5px">${name}</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:10px">${r.profiles?.role_label||''} · ${r.profiles?.project||'—'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div style="background:#f0fdf4;border-radius:6px;padding:8px;text-align:center">
            <div style="font-size:9px;color:#166534;font-weight:700;margin-bottom:3px">ENTRADA</div>
            <div style="font-size:15px;font-weight:800;color:#166534;font-family:monospace">${fmtTime(r.checked_in_at)}</div>
          </div>
          <div style="background:${r.checked_out_at?'#f5f3ff':'#f8fafc'};border-radius:6px;padding:8px;text-align:center">
            <div style="font-size:9px;color:${r.checked_out_at?'#6d28d9':'#94a3b8'};font-weight:700;margin-bottom:3px">SALIDA</div>
            <div style="font-size:15px;font-weight:800;color:${r.checked_out_at?'#6d28d9':'#cbd5e1'};font-family:monospace">${r.checked_out_at?fmtTime(r.checked_out_at):'—'}</div>
          </div>
        </div>
        <div style="font-size:10px;color:#94a3b8;font-family:monospace">
          📍 ${r.checkin_lat.toFixed(5)}, ${r.checkin_lng.toFixed(5)}
        </div>
        <div style="margin-top:8px">
          <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
            background:${r.status==='late'?'#fef3c7':'#dcfce7'};
            color:${r.status==='late'?'#92400e':'#166534'}">
            ${r.status==='late'?'⚠ Con atraso':'✓ A tiempo'}
          </span>
        </div>
      </div>`

      const marker=L.marker([r.checkin_lat,r.checkin_lng],{icon}).addTo(map)
      marker.bindPopup(popup,{maxWidth:240})
      marker.on('click',()=>{ setSelected(r.id); marker.openPopup() })
      if(isSel) marker.openPopup()
      markersRef.current.push(marker)
      bounds.push([r.checkin_lat,r.checkin_lng])

      // Checkout marker
      if(r.checkout_lat&&r.checkout_lng) {
        const outIcon=L.divIcon({
          html:`<div style="width:22px;height:22px;border-radius:50%;background:#6366f1;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;">🚪</div>`,
          className:'',iconSize:[22,22],iconAnchor:[11,11],
        })
        const m2=L.marker([r.checkout_lat,r.checkout_lng],{icon:outIcon}).addTo(map)
        m2.bindPopup(`<div style="font-family:system-ui;font-size:12px"><b>${name}</b><br>Salida: ${fmtTime(r.checked_out_at)}</div>`)
        markersRef.current.push(m2)
        bounds.push([r.checkout_lat,r.checkout_lng])
        // Line
        const line=L.polyline([[r.checkin_lat,r.checkin_lng],[r.checkout_lat,r.checkout_lng]],
          {color,weight:2,opacity:0.4,dashArray:'6 4'}).addTo(map)
        markersRef.current.push(line)
      }
    })

    if(bounds.length>0) {
      try{ map.fitBounds(bounds,{padding:[50,50],maxZoom:15}) }catch(_){}
    }
  }

  function getFiltered() {
    return records.filter(r=>{
      if(projFilter!=='all'&&r.profiles?.project!==projFilter) return false
      if(workerFilter!=='all'&&r.worker_id!==workerFilter) return false
      return true
    })
  }

  function flyTo(r) {
    if(!r.checkin_lat||!mapRef.current) return
    setSelected(r.id)
    mapRef.current.flyTo([r.checkin_lat,r.checkin_lng],16,{duration:1.2})
  }

  const filtered=getFiltered()
  const withGeo=filtered.filter(r=>r.checkin_lat)
  const withoutGeo=filtered.filter(r=>!r.checkin_lat)
  const onTime=filtered.filter(r=>r.status!=='late').length
  const late=filtered.filter(r=>r.status==='late').length

  const allProjects=[...new Set(records.map(r=>r.profiles?.project).filter(Boolean))]
  const allWorkers=[...new Map(records.map(r=>[r.worker_id,r.profiles?.full_name])).entries()]

  // Group list by date
  const byDate=filtered.reduce((acc,r)=>{
    const d=r.checked_in_at?.slice(0,10)||'sin-fecha'
    if(!acc[d])acc[d]=[]
    acc[d].push(r)
    return acc
  },{})

  const AVATAR_COLORS=[{bg:'#dbeafe',col:'#1e3a8a'},{bg:'#d1fae5',col:'#065f46'},{bg:'#fef9c3',col:'#92400e'},{bg:'#fce7f3',col:'#9d174d'},{bg:'#ede9fe',col:'#4c1d95'},{bg:'#cffafe',col:'#0e7490'}]

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">📍 Geolocalización</div>
          <div className="topbar-sub">
            {dateMode==='today'?'Hoy':dateMode==='yesterday'?'Ayer':dateMode==='week'?'Últimos 7 días':customDate||'Personalizado'}
            {' · '}{filtered.length} registro{filtered.length!==1?'s':''}
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={loadData}>↻ Actualizar</button>
        </div>
      </div>

      <div className="content">
        {/* Filters */}
        <div className="card" style={{marginBottom:14,padding:'14px 18px'}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text-4)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.06em'}}>Período</div>
              <div style={{display:'flex',gap:4}}>
                {[['today','Hoy'],['yesterday','Ayer'],['week','7 días'],['custom','Fecha']].map(([v,l])=>(
                  <button key={v} className={`btn btn-sm ${dateMode===v?'btn-primary':''}`} style={{fontSize:11}} onClick={()=>{setDateMode(v);if(v!=='custom')setTimeout(loadData,0)}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {dateMode==='custom'&&(
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'var(--text-4)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.06em'}}>Fecha</div>
                <input type="date" className="form-input" style={{marginBottom:0,fontSize:13,padding:'6px 10px',width:160}} value={customDate} max={today} onChange={e=>{setCustomDate(e.target.value);setTimeout(loadData,100)}}/>
              </div>
            )}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text-4)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.06em'}}>Proyecto</div>
              <select className="form-input" style={{marginBottom:0,fontSize:12,padding:'6px 10px',minWidth:160}} value={projFilter} onChange={e=>setProjFilter(e.target.value)}>
                <option value="all">Todos los proyectos</option>
                {allProjects.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text-4)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.06em'}}>Profesional</div>
              <select className="form-input" style={{marginBottom:0,fontSize:12,padding:'6px 10px',minWidth:160}} value={workerFilter} onChange={e=>setWorkerFilter(e.target.value)}>
                <option value="all">Todos</option>
                {allWorkers.map(([id,name])=><option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            {(projFilter!=='all'||workerFilter!=='all')&&(
              <button className="btn btn-ghost btn-sm" onClick={()=>{setProjFilter('all');setWorkerFilter('all')}}>✕ Limpiar</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:14}}>
          {[
            {label:'Registros',  value:loading?'—':filtered.length, accent:'accent-blue', icon:'📋',ibg:'var(--navy-200)',icl:'var(--navy-700)'},
            {label:'Con GPS',    value:loading?'—':withGeo.length, accent:'accent-green',icon:'📍',ibg:'var(--emerald-l)',icl:'var(--emerald-d)'},
            {label:'A tiempo',   value:loading?'—':onTime, accent:'accent-green',icon:'✔',ibg:'var(--emerald-l)',icl:'var(--emerald-d)'},
            {label:'Con atraso', value:loading?'—':late, accent:late>0?'accent-amber':'accent-green',icon:'⚠',ibg:late>0?'var(--amber-l)':'var(--emerald-l)',icl:late>0?'var(--amber)':'var(--emerald-d)'},
          ].map(s=>(
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`}/>
              <div className="stat-icon" style={{background:s.ibg,color:s.icl}}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Map + List */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:14,marginBottom:14}}>
          {/* MAP */}
          <div className="card" style={{marginBottom:0,padding:0,overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div className="card-title">Mapa de asistencia</div>
                <div className="card-sub">Haz click en un marcador para ver detalle</div>
              </div>
              <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text-4)'}}>
                <span>🟢 A tiempo</span><span>🟡 Atraso</span><span>🟣 Salida</span>
              </div>
            </div>

            {!leafletReady ? (
              <div style={{height:460,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
                <div className="spinner" style={{width:28,height:28}}/>
                <div style={{fontSize:12,color:'var(--text-4)'}}>Cargando mapa...</div>
              </div>
            ) : withGeo.length===0&&!loading ? (
              /* Show map container hidden but mounted, overlay message */
              <div style={{position:'relative'}}>
                <div ref={mapContainerRef} style={{height:460,width:'100%',opacity:0}}/>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'var(--slate-50)'}}>
                  <div style={{fontSize:40,marginBottom:12}}>🗺</div>
                  <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--text-3)',marginBottom:6}}>Sin registros con GPS</div>
                  <div style={{fontSize:12,color:'var(--text-4)',textAlign:'center',maxWidth:260}}>
                    {filtered.length===0?'No hay asistencia registrada para este período':'Los profesionales aún no han marcado con GPS activo'}
                  </div>
                </div>
              </div>
            ) : (
              <div ref={mapContainerRef} style={{height:460,width:'100%'}}/>
            )}
          </div>

          {/* LIST */}
          <div className="card" style={{marginBottom:0,padding:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
              <div className="card-title">Detalle de registros</div>
              <div className="card-sub">Clic → centrar en mapa</div>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {loading?(
                <div className="empty-state" style={{padding:'40px 0'}}><div className="spinner"/></div>
              ) : filtered.length===0?(
                <div className="empty-state" style={{padding:'48px 16px'}}>
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">Sin registros</div>
                  <div className="empty-state-sub">Cambia los filtros</div>
                </div>
              ) : Object.entries(byDate).sort(([a],[b])=>b.localeCompare(a)).map(([date,recs])=>(
                <div key={date}>
                  <div style={{padding:'7px 14px',background:'var(--slate-100)',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',display:'flex',justifyContent:'space-between'}}>
                    <span>{fmtDate(date)}</span>
                    <span style={{fontWeight:400,color:'var(--text-4)'}}>{recs.length} reg.</span>
                  </div>
                  {recs.map((r,i)=>{
                    const c=AVATAR_COLORS[i%AVATAR_COLORS.length]
                    const isSel=r.id===selected
                    const hasGeo=!!r.checkin_lat
                    const ini=(r.profiles?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
                    return (
                      <div key={r.id} onClick={()=>flyTo(r)}
                        style={{padding:'11px 14px',borderBottom:'1px solid var(--border)',cursor:hasGeo?'pointer':'default',background:isSel?'var(--navy-50)':undefined,borderLeft:isSel?'3px solid var(--accent)':'3px solid transparent',transition:'all 0.15s'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:5}}>
                          <div style={{width:32,height:32,borderRadius:'50%',background:c.bg,color:c.col,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>{ini}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:13,color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.profiles?.full_name||'—'}</div>
                            <div style={{fontSize:11,color:'var(--text-4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.profiles?.role_label}{r.profiles?.project?` · ${r.profiles.project}`:''}</div>
                          </div>
                          <span className={`badge ${r.status==='late'?'badge-amber':'badge-green'}`} style={{fontSize:10,flexShrink:0}}>{r.status==='late'?'⚠':'✓'}</span>
                        </div>
                        <div style={{display:'flex',gap:12,fontSize:12}}>
                          <span style={{color:'var(--emerald)',fontFamily:'var(--font-mono)',fontWeight:700}}>↑ {fmtTime(r.checked_in_at)}</span>
                          {r.checked_out_at&&<span style={{color:'#6366f1',fontFamily:'var(--font-mono)',fontWeight:700}}>↓ {fmtTime(r.checked_out_at)}</span>}
                          {!r.checked_out_at&&<span style={{color:'var(--text-4)',fontSize:11}}>En turno</span>}
                        </div>
                        {hasGeo?(
                          <div style={{fontSize:10,color:'var(--text-4)',fontFamily:'var(--font-mono)',marginTop:2}}>📍 {r.checkin_lat.toFixed(4)}, {r.checkin_lng.toFixed(4)}</div>
                        ):(
                          <div style={{fontSize:10,color:'var(--amber)',marginTop:2}}>⚠ Sin GPS</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {withoutGeo.length>0&&(
          <div className="alert alert-warn">
            <span className="alert-icon">⚠</span>
            <div className="alert-body">
              <div className="alert-title">{withoutGeo.length} registro{withoutGeo.length>1?'s':''} sin GPS</div>
              <div className="alert-msg">{withoutGeo.map(r=>r.profiles?.full_name).filter(Boolean).join(', ')} — GPS desactivado o sin conexión.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
