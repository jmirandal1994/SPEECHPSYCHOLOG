import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const MONTHS_S   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const COLORS_MKR = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1']

const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}) : '—'
const fmtDate = str => { if(!str) return '—'; const d=new Date(str+'T12:00:00'); return `${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}` }
const elapsed = ts => { if(!ts) return ''; const m=Math.floor((Date.now()-new Date(ts))/60000); return m<60?`${m}m`:`${Math.floor(m/60)}h${m%60}m` }

export default function GeoMonitor() {
  const mapDivRef  = useRef(null)
  const mapRef     = useRef(null)
  const markersRef = useRef([])
  const timerRef   = useRef(null)

  const [mapReady,    setMapReady]    = useState(false)
  const [records,     setRecords]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [tick,        setTick]        = useState(0) // for elapsed time updates
  const [dateMode,    setDateMode]    = useState('today')
  const [customDate,  setCustomDate]  = useState('')
  const [projFilter,  setProjFilter]  = useState('all')
  const [workerFilter,setWorkerFilter] = useState('all')

  const today     = new Date().toISOString().slice(0,10)
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10)
  const week7     = new Date(Date.now()-7*86400000).toISOString().slice(0,10)
  const queryFrom = dateMode==='today'?today:dateMode==='yesterday'?yesterday:dateMode==='week'?week7:customDate||today

  // Elapsed time ticker
  useEffect(() => {
    const iv = setInterval(() => setTick(t=>t+1), 30000)
    return () => clearInterval(iv)
  }, [])

  // Load Leaflet
  useEffect(() => {
    if (window.L) { setMapReady(true); return }
    const addCss = () => {
      if (!document.getElementById('lf-css')) {
        const l=document.createElement('link'); l.id='lf-css'; l.rel='stylesheet'
        l.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        document.head.appendChild(l)
      }
    }
    addCss()
    if (!document.getElementById('lf-js')) {
      const s=document.createElement('script'); s.id='lf-js'
      s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
      s.onload = () => setMapReady(true)
      document.head.appendChild(s)
    } else {
      const poll=setInterval(()=>{ if(window.L){clearInterval(poll);setMapReady(true)} },80)
      return ()=>clearInterval(poll)
    }
  }, [])

  // Init map
  useEffect(() => {
    if (!mapReady || !mapDivRef.current || mapRef.current) return
    try {
      const L = window.L
      const map = L.map(mapDivRef.current,{ zoomControl:false, attributionControl:false })
        .setView([-33.45,-70.65], 11)

      // Dark map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
        maxZoom:19, subdomains:'abcd',
      }).addTo(map)

      L.control.zoom({ position:'bottomright' }).addTo(map)
      L.control.attribution({ prefix:'© CARTO · OSM', position:'bottomright' }).addTo(map)

      setTimeout(()=>{ try{map.invalidateSize()}catch(_){} }, 300)
      setTimeout(()=>{ try{map.invalidateSize()}catch(_){} }, 800)
      mapRef.current = map
    } catch(e){ console.error('Map init error:',e) }
  }, [mapReady])

  // Cleanup
  useEffect(() => () => {
    if (mapRef.current) { try{mapRef.current.remove()}catch(_){} ; mapRef.current=null }
  }, [])

  // Load data
  useEffect(() => { loadData() }, [queryFrom])

  // Real-time
  useEffect(() => {
    const ch = supabase.channel('geo_rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'attendances'}, loadData)
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  }, [])

  async function loadData() {
    setLoading(true)
    const endDate = dateMode==='week'?today:queryFrom
    const {data} = await supabase
      .from('attendances')
      .select('*, profiles(full_name,role_label,project)')
      .gte('checked_in_at',queryFrom+'T00:00:00')
      .lte('checked_in_at',endDate+'T23:59:59')
      .order('checked_in_at',{ascending:false})
    setRecords(data||[])
    setLoading(false)
  }

  const getFiltered = useCallback(() =>
    records.filter(r => {
      if (projFilter!=='all'&&r.profiles?.project!==projFilter) return false
      if (workerFilter!=='all'&&r.worker_id!==workerFilter) return false
      return true
    }), [records, projFilter, workerFilter])

  // Draw markers
  const drawMarkers = useCallback(() => {
    if (!mapRef.current||!window.L) return
    const L=window.L, map=mapRef.current
    markersRef.current.forEach(m=>{ try{map.removeLayer(m)}catch(_){} })
    markersRef.current=[]
    const filtered=getFiltered()
    const uids=[...new Set(filtered.map(r=>r.worker_id))]
    const colorMap={}
    uids.forEach((id,i)=>{ colorMap[id]=COLORS_MKR[i%COLORS_MKR.length] })
    const bounds=[]
    filtered.forEach(r=>{
      if (!r.checkin_lat||!r.checkin_lng) return
      const color=colorMap[r.worker_id]||'#3b82f6'
      const isSel=r.id===selected
      const name=r.profiles?.full_name||'—'
      const ini=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
      const sz=isSel?50:40
      const isActive=r.checked_in_at&&!r.checked_out_at
      const icon=L.divIcon({
        html:`<div style="position:relative;width:${sz}px;height:${sz+12}px">
          ${isActive?`<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:geo-pulse 2s ease-in-out infinite"></div>`:''}
          <div style="
            width:${sz}px;height:${sz}px;border-radius:50%;
            background:${color};
            border:${isSel?3:2}px solid rgba(255,255,255,${isSel?0.95:0.7});
            box-shadow:0 4px 20px ${color}66${isSel?',0 0 0 4px '+color+'33':''},0 2px 8px rgba(0,0,0,0.5);
            display:flex;align-items:center;justify-content:center;
            font-size:${isSel?15:13}px;font-weight:900;color:#fff;
            font-family:-apple-system,system-ui,sans-serif;
            cursor:pointer;transition:all 0.2s;
          ">${ini}</div>
          <div style="
            position:absolute;bottom:0;left:50%;transform:translateX(-50%);
            width:0;height:0;
            border-left:${sz/4+1}px solid transparent;
            border-right:${sz/4+1}px solid transparent;
            border-top:${sz/3}px solid ${color};
            filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));
          "></div>
        </div>`,
        className:'', iconSize:[sz,sz+12], iconAnchor:[sz/2,sz+12], popupAnchor:[0,-(sz+12)],
      })
      const project = r.profiles?.project||'—'
      const role    = r.profiles?.role_label||''
      const popupHtml=`<div style="
        font-family:-apple-system,system-ui,sans-serif;
        min-width:220px;padding:0;
        background:#0f172a;color:#f1f5f9;border-radius:12px;overflow:hidden;
      ">
        <div style="background:${color}22;padding:14px 16px;border-bottom:1px solid ${color}44">
          <div style="font-weight:800;font-size:15px;color:#fff;margin-bottom:3px">${name}</div>
          <div style="font-size:11px;color:${color};font-weight:600">${role}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">📍 ${project}</div>
        </div>
        <div style="padding:12px 16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div style="background:#0f2720;border-radius:8px;padding:10px;border:1px solid #10b98133">
              <div style="font-size:9px;color:#10b981;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">ENTRADA</div>
              <div style="font-size:18px;font-weight:800;color:#10b981;font-family:monospace">${fmtTime(r.checked_in_at)}</div>
            </div>
            <div style="background:${r.checked_out_at?'#1e1040':'#1e293b'};border-radius:8px;padding:10px;border:1px solid ${r.checked_out_at?'#8b5cf633':'#334155'}">
              <div style="font-size:9px;color:${r.checked_out_at?'#8b5cf6':'#475569'};font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">SALIDA</div>
              <div style="font-size:18px;font-weight:800;color:${r.checked_out_at?'#a78bfa':'#475569'};font-family:monospace">${r.checked_out_at?fmtTime(r.checked_out_at):'En turno'}</div>
            </div>
          </div>
          <div style="font-size:10px;color:#475569;font-family:monospace;margin-bottom:8px">
            🌐 ${r.checkin_lat?.toFixed(5)}, ${r.checkin_lng?.toFixed(5)}
          </div>
          <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;
            background:${r.status==='late'?'rgba(245,158,11,0.2)':'rgba(16,185,129,0.2)'};
            color:${r.status==='late'?'#f59e0b':'#10b981'};
            border:1px solid ${r.status==='late'?'#f59e0b44':'#10b98144'}">
            ${r.status==='late'?'⚠ Con atraso':'✓ Puntual'}
          </div>
        </div>
      </div>`

      try {
        const marker=L.marker([r.checkin_lat,r.checkin_lng],{icon}).addTo(map)
        marker.bindPopup(popupHtml,{
          maxWidth:260,
          className:'geo-dark-popup',
          closeButton:true,
        })
        marker.on('click',()=>{setSelected(r.id);marker.openPopup()})
        if(isSel) setTimeout(()=>{try{marker.openPopup()}catch(_){}},100)
        markersRef.current.push(marker)
        bounds.push([r.checkin_lat,r.checkin_lng])
      } catch(_){}

      // Checkout secondary marker
      if(r.checkout_lat&&r.checkout_lng){
        try{
          const outIcon=L.divIcon({
            html:`<div style="width:18px;height:18px;border-radius:50%;background:#7c3aed;border:2px solid rgba(255,255,255,0.6);box-shadow:0 2px 10px rgba(124,58,237,0.5);display:flex;align-items:center;justify-content:center;font-size:9px">🏁</div>`,
            className:'',iconSize:[18,18],iconAnchor:[9,9],
          })
          const m2=L.marker([r.checkout_lat,r.checkout_lng],{icon:outIcon}).addTo(map)
          m2.bindPopup(`<div style="font-family:system-ui;font-size:12px;background:#0f172a;color:#f1f5f9;padding:8px 12px;border-radius:8px"><b>${name}</b><br>Salida: ${fmtTime(r.checked_out_at)}</div>`,{className:'geo-dark-popup'})
          markersRef.current.push(m2)
          bounds.push([r.checkout_lat,r.checkout_lng])
          const line=L.polyline([[r.checkin_lat,r.checkin_lng],[r.checkout_lat,r.checkout_lng]],{color,weight:2,opacity:0.3,dashArray:'5 6'}).addTo(map)
          markersRef.current.push(line)
        }catch(_){}
      }
    })
    if(bounds.length>0){
      try{map.fitBounds(bounds,{padding:[60,60],maxZoom:16,animate:true})}catch(_){}
    }
  },[getFiltered, selected])

  useEffect(()=>{
    if(mapRef.current&&!loading) setTimeout(drawMarkers,150)
  },[records, selected, loading, projFilter, workerFilter, drawMarkers])

  function flyTo(r){
    if(!r.checkin_lat||!mapRef.current) return
    setSelected(r.id)
    try{mapRef.current.flyTo([r.checkin_lat,r.checkin_lng],17,{duration:1.0,animate:true})}catch(_){}
  }

  const filtered   = getFiltered()
  const withGeo    = filtered.filter(r=>r.checkin_lat)
  const active     = filtered.filter(r=>r.checked_in_at&&!r.checked_out_at)
  const completed  = filtered.filter(r=>r.checked_out_at)
  const lateCount  = filtered.filter(r=>r.status==='late').length
  const allProjects= [...new Set(records.map(r=>r.profiles?.project).filter(Boolean))]
  const allWorkers = [...new Map(records.map(r=>[r.worker_id,r.profiles?.full_name])).entries()]

  const byDate = filtered.reduce((acc,r)=>{
    const d=r.checked_in_at?.slice(0,10)||'sin-fecha'
    if(!acc[d])acc[d]=[]
    acc[d].push(r)
    return acc
  },{})

  const selRecord = selected ? filtered.find(r=>r.id===selected) : null

  // Inject CSS animations
  useEffect(()=>{
    if (!document.getElementById('geo-styles')) {
      const s=document.createElement('style'); s.id='geo-styles'
      s.textContent=`
        @keyframes geo-pulse{0%,100%{transform:scale(1);opacity:0.5}50%{transform:scale(1.4);opacity:0.2}}
        .geo-dark-popup .leaflet-popup-content-wrapper{background:#0f172a!important;border:1px solid rgba(59,130,246,0.3)!important;border-radius:14px!important;box-shadow:0 20px 60px rgba(0,0,0,0.6)!important;padding:0!important}
        .geo-dark-popup .leaflet-popup-tip{background:#0f172a!important}
        .geo-dark-popup .leaflet-popup-content{margin:0!important}
        .geo-dark-popup .leaflet-popup-close-button{color:#64748b!important;top:10px!important;right:12px!important;font-size:18px!important}
      `
      document.head.appendChild(s)
    }
  },[])

  return (
    <div className="page-enter" style={{background:'#060d1a',minHeight:'100%'}}>
      {/* Top command bar */}
      <div style={{
        padding:'0 24px',height:60,
        background:'rgba(6,13,26,0.95)',
        backdropFilter:'blur(12px)',
        borderBottom:'1px solid rgba(59,130,246,0.15)',
        display:'flex',alignItems:'center',justifyContent:'space-between',
        flexShrink:0,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:800,color:'#f1f5f9',letterSpacing:'-0.03em'}}>
              📍 Centro de Monitoreo
            </div>
            <div style={{fontSize:11,color:'#475569',marginTop:1}}>
              Seguimiento en tiempo real · {dateMode==='today'?'Hoy':dateMode==='yesterday'?'Ayer':dateMode==='week'?'7 días':customDate}
            </div>
          </div>
          {/* Live indicator */}
          <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:20,padding:'4px 12px'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#10b981',boxShadow:'0 0 8px #10b98188',animation:'geo-pulse 2s ease-in-out infinite'}}/>
            <span style={{fontSize:11,color:'#10b981',fontWeight:700}}>EN VIVO</span>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={loadData} style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',color:'#93c5fd',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-body)'}}>
            ↻ Actualizar
          </button>
        </div>
      </div>

      <div style={{display:'flex',height:'calc(100% - 60px)',overflow:'hidden'}}>

        {/* LEFT SIDEBAR — filters + list */}
        <div style={{
          width:320,flexShrink:0,
          display:'flex',flexDirection:'column',
          background:'rgba(10,18,32,0.98)',
          borderRight:'1px solid rgba(59,130,246,0.12)',
          overflow:'hidden',
        }}>
          {/* Filters */}
          <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(59,130,246,0.1)'}}>
            {/* Date pills */}
            <div style={{display:'flex',gap:4,marginBottom:10}}>
              {[['today','Hoy'],['yesterday','Ayer'],['week','7d'],['custom','📅']].map(([v,l])=>(
                <button key={v} onClick={()=>setDateMode(v)}
                  style={{
                    flex:1,padding:'5px 4px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',
                    border:`1px solid ${dateMode===v?'rgba(59,130,246,0.6)':'rgba(59,130,246,0.12)'}`,
                    background:dateMode===v?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.02)',
                    color:dateMode===v?'#93c5fd':'#64748b',
                    fontFamily:'var(--font-body)',transition:'all 0.15s',
                  }}>{l}</button>
              ))}
            </div>
            {dateMode==='custom'&&(
              <input type="date" max={today} value={customDate}
                onChange={e=>{setCustomDate(e.target.value);if(e.target.value)setTimeout(loadData,100)}}
                style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:6,color:'#f1f5f9',padding:'6px 10px',fontSize:12,fontFamily:'var(--font-mono)',marginBottom:10,boxSizing:'border-box'}}/>
            )}
            {/* Project select */}
            <select value={projFilter} onChange={e=>setProjFilter(e.target.value)}
              style={{width:'100%',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:6,color:'#94a3b8',padding:'6px 10px',fontSize:12,marginBottom:8,fontFamily:'var(--font-body)',boxSizing:'border-box'}}>
              <option value="all">Todos los proyectos</option>
              {allProjects.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            {/* Worker select */}
            <select value={workerFilter} onChange={e=>setWorkerFilter(e.target.value)}
              style={{width:'100%',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:6,color:'#94a3b8',padding:'6px 10px',fontSize:12,fontFamily:'var(--font-body)',boxSizing:'border-box'}}>
              <option value="all">Todos los profesionales</option>
              {allWorkers.map(([id,name])=><option key={id} value={id}>{name}</option>)}
            </select>
          </div>

          {/* Mini stats */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderBottom:'1px solid rgba(59,130,246,0.1)'}}>
            {[
              {label:'Con GPS',val:withGeo.length,color:'#3b82f6'},
              {label:'Activos',val:active.length,color:'#10b981'},
              {label:'Atrasos',val:lateCount,color:lateCount>0?'#f59e0b':'#475569'},
            ].map(s=>(
              <div key={s.label} style={{padding:'12px 10px',textAlign:'center',borderRight:'1px solid rgba(59,130,246,0.08)'}}>
                <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:22,color:s.color,lineHeight:1}}>{loading?'—':s.val}</div>
                <div style={{fontSize:9,color:'#475569',marginTop:3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Records list */}
          <div style={{overflowY:'auto',flex:1}}>
            {loading ? (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:120,color:'#475569',gap:10}}>
                <div className="spinner" style={{width:20,height:20,borderColor:'rgba(59,130,246,0.2)',borderTopColor:'#3b82f6'}}/>
                <span style={{fontSize:13}}>Cargando...</span>
              </div>
            ) : filtered.length===0 ? (
              <div style={{padding:'40px 20px',textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:10}}>🗺</div>
                <div style={{color:'#475569',fontSize:13,fontWeight:600}}>Sin registros</div>
                <div style={{color:'#334155',fontSize:12,marginTop:4}}>Cambia los filtros o el período</div>
              </div>
            ) : (
              Object.entries(byDate).sort(([a],[b])=>b.localeCompare(a)).map(([date,recs])=>(
                <div key={date}>
                  {/* Date header */}
                  <div style={{
                    padding:'8px 16px',
                    background:'rgba(59,130,246,0.05)',
                    borderBottom:'1px solid rgba(59,130,246,0.08)',
                    borderTop:'1px solid rgba(59,130,246,0.08)',
                    fontSize:10,fontWeight:800,
                    color:'#3b82f6',textTransform:'uppercase',letterSpacing:'.1em',
                    display:'flex',justifyContent:'space-between',
                  }}>
                    <span>{fmtDate(date)}</span>
                    <span style={{color:'#334155',fontWeight:600}}>{recs.length} reg.</span>
                  </div>
                  {recs.map(r=>{
                    const isSel  = r.id===selected
                    const isAct  = r.checked_in_at&&!r.checked_out_at
                    const name   = r.profiles?.full_name||'—'
                    const ini    = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
                    const uids2  = [...new Set(records.map(x=>x.worker_id))]
                    const color  = COLORS_MKR[uids2.indexOf(r.worker_id)%COLORS_MKR.length]||'#3b82f6'
                    return (
                      <div key={r.id} onClick={()=>flyTo(r)}
                        style={{
                          padding:'10px 14px',
                          borderBottom:'1px solid rgba(59,130,246,0.06)',
                          cursor:r.checkin_lat?'pointer':'default',
                          background:isSel?`${color}12`:'transparent',
                          borderLeft:isSel?`3px solid ${color}`:'3px solid transparent',
                          transition:'all 0.15s',
                        }}
                        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='rgba(255,255,255,0.02)'}}
                        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='transparent'}}
                      >
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                          {/* Avatar with pulse if active */}
                          <div style={{position:'relative',flexShrink:0}}>
                            {isAct&&<div style={{position:'absolute',inset:-3,borderRadius:'50%',border:`1px solid ${color}`,opacity:0.5,animation:'geo-pulse 2s ease-in-out infinite'}}/>}
                            <div style={{width:32,height:32,borderRadius:'50%',background:`${color}22`,border:`2px solid ${color}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:color}}>
                              {ini}
                            </div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:13,color:isSel?color:'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
                            <div style={{fontSize:10,color:'#475569',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:1}}>
                              {r.profiles?.role_label}{r.profiles?.project?` · ${r.profiles.project}`:''}
                            </div>
                          </div>
                          {/* Status dot */}
                          <div style={{flexShrink:0,width:8,height:8,borderRadius:'50%',background:r.status==='late'?'#f59e0b':isAct?'#10b981':'#475569',boxShadow:isAct?`0 0 8px ${isAct?'#10b981':'transparent'}`:undefined}}/>
                        </div>
                        {/* Times */}
                        <div style={{display:'flex',gap:12,fontSize:11,fontFamily:'var(--font-mono)'}}>
                          <span style={{color:'#10b981',fontWeight:700}}>↑ {fmtTime(r.checked_in_at)}</span>
                          {r.checked_out_at
                            ? <span style={{color:'#8b5cf6',fontWeight:700}}>↓ {fmtTime(r.checked_out_at)}</span>
                            : isAct
                              ? <span style={{color:'#3b82f6',fontWeight:600}}>● {elapsed(r.checked_in_at)}</span>
                              : null}
                        </div>
                        {!r.checkin_lat && (
                          <div style={{fontSize:10,color:'#f59e0b',marginTop:3}}>⚠ Sin GPS</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* MAIN — Map + detail */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>

          {/* Map */}
          <div style={{flex:1,position:'relative'}}>
            <div ref={mapDivRef} style={{position:'absolute',inset:0}}/>

            {/* Map overlay: loading */}
            {!mapReady&&(
              <div style={{position:'absolute',inset:0,background:'#060d1a',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14,zIndex:10}}>
                <div className="spinner" style={{width:32,height:32,borderColor:'rgba(59,130,246,0.15)',borderTopColor:'#3b82f6'}}/>
                <div style={{color:'#475569',fontSize:13}}>Inicializando mapa satelital...</div>
              </div>
            )}

            {/* Map overlay: no GPS data */}
            {mapReady&&!loading&&withGeo.length===0&&(
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14,zIndex:5,background:'rgba(6,13,26,0.7)',backdropFilter:'blur(4px)'}}>
                <div style={{fontSize:48}}>🛰</div>
                <div style={{fontFamily:'var(--font-display)',color:'#94a3b8',fontSize:17,fontWeight:700}}>Sin señal GPS</div>
                <div style={{color:'#475569',fontSize:13,textAlign:'center',maxWidth:260,lineHeight:1.6}}>
                  {filtered.length===0?'No hay registros para este período':'Los profesionales marcaron sin GPS activo'}
                </div>
              </div>
            )}

            {/* Data loading overlay */}
            {mapReady&&loading&&(
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:5,background:'rgba(6,13,26,0.5)',backdropFilter:'blur(2px)'}}>
                <div className="spinner" style={{width:28,height:28,borderColor:'rgba(59,130,246,0.15)',borderTopColor:'#3b82f6'}}/>
              </div>
            )}

            {/* Legend */}
            <div style={{
              position:'absolute',top:14,left:14,zIndex:400,
              background:'rgba(10,18,32,0.92)',backdropFilter:'blur(10px)',
              border:'1px solid rgba(59,130,246,0.2)',borderRadius:10,
              padding:'10px 14px',
            }}>
              <div style={{fontSize:9,fontWeight:800,color:'#3b82f6',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>Leyenda</div>
              {[
                {color:'#10b981',label:'Activo en turno',pulse:true},
                {color:'#8b5cf6',label:'Turno completado',pulse:false},
                {color:'#f59e0b',label:'Con atraso',pulse:false},
              ].map(l=>(
                <div key={l.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <div style={{position:'relative',width:10,height:10,flexShrink:0}}>
                    {l.pulse&&<div style={{position:'absolute',inset:-2,borderRadius:'50%',border:`1px solid ${l.color}`,opacity:0.5,animation:'geo-pulse 2s ease-in-out infinite'}}/>}
                    <div style={{width:10,height:10,borderRadius:'50%',background:l.color}}/>
                  </div>
                  <span style={{fontSize:10,color:'#94a3b8'}}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Total counter chip */}
            {!loading&&(
              <div style={{
                position:'absolute',top:14,right:14,zIndex:400,
                background:'rgba(10,18,32,0.92)',backdropFilter:'blur(10px)',
                border:'1px solid rgba(59,130,246,0.2)',borderRadius:10,
                padding:'8px 14px',
                display:'flex',gap:16,
              }}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:20,color:'#3b82f6'}}>{filtered.length}</div>
                  <div style={{fontSize:9,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>Total</div>
                </div>
                <div style={{width:1,background:'rgba(59,130,246,0.15)'}}/>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:20,color:'#10b981'}}>{active.length}</div>
                  <div style={{fontSize:9,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>Activos</div>
                </div>
                <div style={{width:1,background:'rgba(59,130,246,0.15)'}}/>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:20,color:'#8b5cf6'}}>{completed.length}</div>
                  <div style={{fontSize:9,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>Completados</div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom detail panel when record selected */}
          {selRecord && (
            <div style={{
              flexShrink:0,
              background:'rgba(10,18,32,0.98)',
              borderTop:'1px solid rgba(59,130,246,0.2)',
              padding:'14px 20px',
              display:'flex',alignItems:'center',gap:20,
              backdropFilter:'blur(12px)',
            }}>
              {(() => {
                const r=selRecord
                const uids2=[...new Set(records.map(x=>x.worker_id))]
                const color=COLORS_MKR[uids2.indexOf(r.worker_id)%COLORS_MKR.length]||'#3b82f6'
                const isAct=r.checked_in_at&&!r.checked_out_at
                return <>
                  <div style={{width:40,height:40,borderRadius:'50%',background:`${color}22`,border:`2px solid ${color}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color,flexShrink:0}}>
                    {(r.profiles?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#f1f5f9'}}>{r.profiles?.full_name||'—'}</div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{r.profiles?.role_label} · {r.profiles?.project||'sin proyecto'}</div>
                  </div>
                  <div style={{display:'flex',gap:16,alignItems:'center'}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:18,fontWeight:800,color:'#10b981'}}>{fmtTime(r.checked_in_at)}</div>
                      <div style={{fontSize:9,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>Entrada</div>
                    </div>
                    <div style={{color:'#334155',fontSize:18}}>→</div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:18,fontWeight:800,color:r.checked_out_at?'#8b5cf6':'#3b82f6'}}>{r.checked_out_at?fmtTime(r.checked_out_at):(isAct?'● '+elapsed(r.checked_in_at):'—')}</div>
                      <div style={{fontSize:9,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>{r.checked_out_at?'Salida':'En turno'}</div>
                    </div>
                    {r.checkin_lat&&(
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:11,color:'#10b981',fontFamily:'var(--font-mono)',fontWeight:600}}>{r.checkin_lat.toFixed(4)}</div>
                        <div style={{fontSize:11,color:'#10b981',fontFamily:'var(--font-mono)',fontWeight:600}}>{r.checkin_lng.toFixed(4)}</div>
                        <div style={{fontSize:9,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>GPS</div>
                      </div>
                    )}
                    <div style={{
                      padding:'4px 14px',borderRadius:20,fontSize:11,fontWeight:700,
                      background:r.status==='late'?'rgba(245,158,11,0.15)':'rgba(16,185,129,0.15)',
                      color:r.status==='late'?'#f59e0b':'#10b981',
                      border:`1px solid ${r.status==='late'?'rgba(245,158,11,0.3)':'rgba(16,185,129,0.3)'}`,
                    }}>
                      {r.status==='late'?'⚠ Con atraso':'✓ Puntual'}
                    </div>
                    <button onClick={()=>setSelected(null)} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#64748b',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontSize:12,fontFamily:'var(--font-body)'}}>✕</button>
                  </div>
                </>
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
