import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function formatDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
function formatTime(str) {
  if (!str) return '—'
  return new Date(str).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function daysBefore(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const COLORS_MAP = [
  '#1d4ed8','#059669','#d97706','#dc2626','#7c3aed','#0891b2',
  '#db2777','#65a30d','#ea580c','#4338ca',
]

export default function GeoMonitor() {
  const mapRef      = useRef(null)
  const leafletRef  = useRef(null)
  const markersRef  = useRef([])

  const [records,   setRecords]   = useState([])
  const [projects,  setProjects]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [leafletOk, setLeafletOk] = useState(false)
  const [selected,  setSelected]  = useState(null)  // record id

  // Filters
  const [dateFilter,    setDateFilter]    = useState('today')   // today | yesterday | week | custom
  const [customDate,    setCustomDate]    = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [workerFilter,  setWorkerFilter]  = useState('all')

  // Derived date string for query
  const queryDate = (() => {
    if (dateFilter === 'today')     return new Date().toISOString().slice(0, 10)
    if (dateFilter === 'yesterday') return daysBefore(1)
    if (dateFilter === 'week')      return daysBefore(7)
    if (dateFilter === 'custom')    return customDate
    return new Date().toISOString().slice(0, 10)
  })()

  // Workers derived from records
  const workers = [...new Map(
    records.map(r => [r.worker_id, r.profiles?.full_name])
  ).entries()].map(([id, name]) => ({ id, name }))

  // Filtered records
  const filtered = records.filter(r => {
    if (projectFilter !== 'all' && r.profiles?.project !== projectFilter) return false
    if (workerFilter  !== 'all' && r.worker_id !== workerFilter)           return false
    return true
  })

  // ── Load Leaflet once ──
  useEffect(() => {
    if (window.L) { setLeafletOk(true); return }
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link')
      css.id = 'leaflet-css'; css.rel = 'stylesheet'
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(css)
    }
    if (!document.getElementById('leaflet-js')) {
      const js = document.createElement('script')
      js.id  = 'leaflet-js'
      js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
      js.onload = () => setLeafletOk(true)
      document.head.appendChild(js)
    }
  }, [])

  // ── Init map once Leaflet is ready ──
  useEffect(() => {
    if (!leafletOk || !mapRef.current || leafletRef.current) return
    const L   = window.L
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-33.45, -70.65], 11) // Santiago default

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    L.control.attribution({ prefix: false }).addTo(map)
    leafletRef.current = map
  }, [leafletOk])

  // ── Load data when date filter changes ──
  useEffect(() => {
    if (!queryDate) return
    loadData(queryDate)
  }, [queryDate])

  // ── Load projects ──
  useEffect(() => {
    supabase.from('projects').select('name').eq('active', true).order('name')
      .then(({ data }) => setProjects(data?.map(p => p.name) || []))
  }, [])

  async function loadData(fromDate) {
    setLoading(true)
    setSelected(null)

    const endDate = dateFilter === 'week'
      ? new Date().toISOString().slice(0, 10)
      : fromDate

    let q = supabase
      .from('attendances')
      .select('*, profiles(full_name, role_label, project)')
      .order('checked_in_at', { ascending: false })

    if (dateFilter === 'week') {
      q = q.gte('checked_in_at', fromDate + 'T00:00:00')
    } else {
      q = q.gte('checked_in_at', fromDate + 'T00:00:00')
             .lte('checked_in_at', fromDate + 'T23:59:59')
    }

    const { data, error } = await q
    setRecords(data || [])
    setLoading(false)
  }

  // ── Render markers whenever filtered records or map changes ──
  useEffect(() => {
    if (!leafletRef.current || !leafletOk) return
    drawMarkers(filtered)
  }, [filtered, leafletOk, selected])

  function drawMarkers(recs) {
    const L   = window.L
    const map = leafletRef.current
    if (!L || !map) return

    // Remove old markers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    // Group by worker for color assignment
    const workerColors = {}
    const uniqueWorkers = [...new Set(recs.map(r => r.worker_id))]
    uniqueWorkers.forEach((id, i) => { workerColors[id] = COLORS_MAP[i % COLORS_MAP.length] })

    const bounds = []

    recs.forEach(r => {
      const color     = workerColors[r.worker_id] || '#1d4ed8'
      const isSelected = r.id === selected
      const name      = r.profiles?.full_name || 'Sin nombre'
      const project   = r.profiles?.project   || '—'
      const ini       = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

      // Checkin marker
      if (r.checkin_lat && r.checkin_lng) {
        const icon = L.divIcon({
          html: `
            <div style="
              position:relative;
              width:${isSelected ? 44 : 36}px;
              height:${isSelected ? 44 : 36}px;
              border-radius:50%;
              background:${color};
              border:${isSelected ? '3px solid #fff' : '2px solid rgba(255,255,255,0.8)'};
              box-shadow:0 2px 12px rgba(0,0,0,0.35)${isSelected ? ',0 0 0 4px ' + color + '55' : ''};
              display:flex;align-items:center;justify-content:center;
              font-size:11px;font-weight:800;color:#fff;
              font-family:system-ui;
              transition:all 0.2s;
              cursor:pointer;
            ">${ini}</div>
            <div style="
              position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
              width:0;height:0;
              border-left:5px solid transparent;border-right:5px solid transparent;
              border-top:7px solid ${color};
            "></div>`,
          className: '',
          iconSize:   [isSelected ? 44 : 36, isSelected ? 50 : 42],
          iconAnchor: [isSelected ? 22 : 18, isSelected ? 50 : 42],
        })

        const dateStr = r.checked_in_at ? r.checked_in_at.slice(0, 10) : ''

        const marker = L.marker([r.checkin_lat, r.checkin_lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:system-ui;min-width:200px;padding:4px 0">
              <div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:6px">${name}</div>
              <div style="font-size:11px;color:#64748b;margin-bottom:10px">${r.profiles?.role_label || ''} · ${project}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                <div style="background:#f0fdf4;border-radius:6px;padding:8px">
                  <div style="font-size:9px;color:#166534;font-weight:700;margin-bottom:2px;text-transform:uppercase">ENTRADA</div>
                  <div style="font-size:14px;font-weight:800;color:#166534;font-family:monospace">${formatTime(r.checked_in_at)}</div>
                  <div style="font-size:10px;color:#4ade80;margin-top:2px">${dateStr}</div>
                </div>
                <div style="background:${r.checked_out_at ? '#f5f3ff' : '#f8fafc'};border-radius:6px;padding:8px">
                  <div style="font-size:9px;color:${r.checked_out_at ? '#6d28d9' : '#94a3b8'};font-weight:700;margin-bottom:2px;text-transform:uppercase">SALIDA</div>
                  <div style="font-size:14px;font-weight:800;color:${r.checked_out_at ? '#6d28d9' : '#cbd5e1'};font-family:monospace">${r.checked_out_at ? formatTime(r.checked_out_at) : '—'}</div>
                </div>
              </div>
              <div style="font-size:10px;color:#94a3b8;font-family:monospace">
                📍 ${r.checkin_lat.toFixed(5)}, ${r.checkin_lng.toFixed(5)}
              </div>
              <div style="margin-top:8px">
                <span style="
                  display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
                  background:${r.status === 'late' ? '#fef3c7' : '#dcfce7'};
                  color:${r.status === 'late' ? '#92400e' : '#166534'};
                ">${r.status === 'late' ? '⚠ Con atraso' : '✓ A tiempo'}</span>
              </div>
            </div>
          `, { maxWidth: 240, className: 'geo-popup' })

        marker.on('click', () => setSelected(r.id))
        markersRef.current.push(marker)
        bounds.push([r.checkin_lat, r.checkin_lng])
      }

      // Checkout marker (different location)
      if (r.checkout_lat && r.checkout_lng) {
        const outIcon = L.divIcon({
          html: `<div style="
            width:22px;height:22px;border-radius:50%;
            background:#6366f1;border:2px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:10px;
          ">🚪</div>`,
          className: '',
          iconSize: [22, 22], iconAnchor: [11, 11],
        })
        const m2 = L.marker([r.checkout_lat, r.checkout_lng], { icon: outIcon })
          .addTo(map)
          .bindPopup(`<div style="font-family:system-ui;font-size:12px"><b>${name}</b><br>Salida: ${formatTime(r.checked_out_at)}</div>`)
        markersRef.current.push(m2)
        bounds.push([r.checkout_lat, r.checkout_lng])
      }

      // Line between checkin and checkout
      if (r.checkin_lat && r.checkout_lat) {
        const line = L.polyline(
          [[r.checkin_lat, r.checkin_lng], [r.checkout_lat, r.checkout_lng]],
          { color, weight: 2, opacity: 0.4, dashArray: '6 4' }
        ).addTo(map)
        markersRef.current.push(line)
      }
    })

    // Fit map to markers
    if (bounds.length > 0) {
      try {
        leafletRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true })
      } catch (_) {}
    }
  }

  function flyTo(r) {
    if (!r.checkin_lat || !leafletRef.current) return
    setSelected(r.id)
    leafletRef.current.flyTo([r.checkin_lat, r.checkin_lng], 16, { duration: 1.2 })
  }

  const withGeo    = filtered.filter(r => r.checkin_lat)
  const withoutGeo = filtered.filter(r => !r.checkin_lat)
  const onTime     = filtered.filter(r => r.status !== 'late')
  const late       = filtered.filter(r => r.status === 'late')

  // Group by date for the "week" view list
  const byDate = filtered.reduce((acc, r) => {
    const d = r.checked_in_at?.slice(0, 10) || 'sin fecha'
    if (!acc[d]) acc[d] = []
    acc[d].push(r)
    return acc
  }, {})

  const AVATAR_COLORS = [
    { bg: '#dbeafe', col: '#1e3a8a' }, { bg: '#d1fae5', col: '#065f46' },
    { bg: '#fef9c3', col: '#92400e' }, { bg: '#fce7f3', col: '#9d174d' },
    { bg: '#ede9fe', col: '#4c1d95' }, { bg: '#cffafe', col: '#0e7490' },
  ]

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">📍 Geolocalización</div>
          <div className="topbar-sub">
            Monitoreo de asistencia ·{' '}
            {dateFilter === 'today'     ? 'Hoy'        :
             dateFilter === 'yesterday' ? 'Ayer'        :
             dateFilter === 'week'      ? 'Últimos 7 días' :
             customDate || 'Fecha personalizada'}
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={() => loadData(queryDate)}>↻ Actualizar</button>
        </div>
      </div>

      <div className="content">
        {/* ── FILTERS ── */}
        <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Date filter */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Período</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['today','Hoy'],['yesterday','Ayer'],['week','7 días'],['custom','Fecha']].map(([v, l]) => (
                  <button
                    key={v}
                    className={`btn btn-sm ${dateFilter === v ? 'btn-primary' : ''}`}
                    style={{ fontSize: 11 }}
                    onClick={() => setDateFilter(v)}
                  >{l}</button>
                ))}
              </div>
            </div>

            {/* Custom date picker */}
            {dateFilter === 'custom' && (
              <div style={{ flex: '0 0 auto' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fecha</div>
                <input
                  type="date"
                  className="form-input"
                  style={{ marginBottom: 0, fontSize: 13, padding: '6px 10px', width: 160 }}
                  value={customDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setCustomDate(e.target.value)}
                />
              </div>
            )}

            {/* Project filter */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Proyecto</div>
              <select
                className="form-input"
                style={{ marginBottom: 0, fontSize: 12, padding: '6px 10px', minWidth: 160 }}
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
              >
                <option value="all">Todos los proyectos</option>
                {[...new Set([
                  ...projects,
                  ...records.map(r => r.profiles?.project).filter(Boolean)
                ])].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Worker filter */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Profesional</div>
              <select
                className="form-input"
                style={{ marginBottom: 0, fontSize: 12, padding: '6px 10px', minWidth: 160 }}
                value={workerFilter}
                onChange={e => setWorkerFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* Reset */}
            {(projectFilter !== 'all' || workerFilter !== 'all') && (
              <div style={{ flex: '0 0 auto' }}>
                <div style={{ fontSize: 10, marginBottom: 5, color: 'transparent' }}>x</div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setProjectFilter('all'); setWorkerFilter('all') }}>
                  ✕ Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
          {[
            { label: 'Registros',    value: loading ? '—' : filtered.length, accent: 'accent-blue',  icon: '📋', ibg: 'var(--navy-200)',   icl: 'var(--navy-700)' },
            { label: 'Con GPS',      value: loading ? '—' : withGeo.length,  accent: 'accent-green', icon: '📍', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)' },
            { label: 'A tiempo',     value: loading ? '—' : onTime.length,   accent: 'accent-green', icon: '✔',  ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)' },
            { label: 'Con atraso',   value: loading ? '—' : late.length,     accent: late.length > 0 ? 'accent-amber' : 'accent-green', icon: '⚠', ibg: late.length > 0 ? 'var(--amber-l)' : 'var(--emerald-l)', icl: late.length > 0 ? 'var(--amber)' : 'var(--emerald-d)' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.ibg, color: s.icl }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN LAYOUT: MAP + LIST ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 16 }}>

          {/* MAP */}
          <div className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="card-title">Mapa de asistencia</div>
                <div className="card-sub">{filtered.length} registro{filtered.length !== 1 ? 's' : ''} · haz clic en un profesional para ver detalle</div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-4)', flexWrap: 'wrap' }}>
                <span>🟢 A tiempo</span>
                <span>🟡 Con atraso</span>
                <span>🟣 Salida</span>
              </div>
            </div>

            {!leafletOk || loading ? (
              <div style={{ height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                  {!leafletOk ? 'Cargando mapa...' : 'Cargando registros...'}
                </div>
              </div>
            ) : withGeo.length === 0 ? (
              <div className="empty-state" style={{ height: 460 }}>
                <div className="empty-state-icon">🗺</div>
                <div className="empty-state-title">Sin registros con GPS</div>
                <div className="empty-state-sub">
                  {filtered.length === 0
                    ? 'No hay asistencia registrada para este período'
                    : `${filtered.length} registro${filtered.length > 1 ? 's' : ''} sin coordenadas GPS`}
                </div>
              </div>
            ) : (
              <div ref={mapRef} style={{ height: 460, width: '100%' }} />
            )}
          </div>

          {/* LIST */}
          <div className="card" style={{ marginBottom: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div className="card-title">Detalle de registros</div>
              <div className="card-sub">Click para centrar en mapa</div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div className="empty-state" style={{ padding: '40px 0' }}><div className="spinner" /></div>
              ) : filtered.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px 16px' }}>
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">Sin registros</div>
                  <div className="empty-state-sub">Cambia los filtros para ver datos</div>
                </div>
              ) : (
                // Group by date
                Object.entries(byDate)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, dayRecs]) => (
                    <div key={date}>
                      {/* Date header */}
                      <div style={{
                        padding: '8px 16px',
                        background: 'var(--slate-100)',
                        borderBottom: '1px solid var(--border)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-3)',
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span>{formatDate(date + 'T12:00:00')}</span>
                        <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>
                          {dayRecs.length} registro{dayRecs.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {dayRecs.map((r, i) => {
                        const c   = AVATAR_COLORS[i % AVATAR_COLORS.length]
                        const ini = (r.profiles?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                        const isSelected = r.id === selected
                        const hasGeo = !!r.checkin_lat

                        return (
                          <div
                            key={r.id}
                            onClick={() => flyTo(r)}
                            style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid var(--border)',
                              cursor: hasGeo ? 'pointer' : 'default',
                              background: isSelected ? 'var(--navy-50)' : undefined,
                              borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                              transition: 'all 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, fontFamily: 'var(--font-display)' }}>
                                {ini}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.profiles?.full_name || '—'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.profiles?.role_label}
                                  {r.profiles?.project ? ` · ${r.profiles.project}` : ''}
                                </div>
                              </div>
                              <span className={`badge ${r.status === 'late' ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                                {r.status === 'late' ? '⚠' : '✓'}
                              </span>
                            </div>

                            {/* Times */}
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: hasGeo ? 4 : 0 }}>
                              <span style={{ color: 'var(--emerald)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                ↑ {formatTime(r.checked_in_at)}
                              </span>
                              {r.checked_out_at && (
                                <span style={{ color: '#6366f1', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                  ↓ {formatTime(r.checked_out_at)}
                                </span>
                              )}
                              {!r.checked_out_at && (
                                <span style={{ color: 'var(--text-4)', fontSize: 11 }}>En turno</span>
                              )}
                            </div>

                            {/* GPS coords or no-GPS notice */}
                            {hasGeo ? (
                              <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                📍 {r.checkin_lat.toFixed(4)}, {r.checkin_lng.toFixed(4)}
                              </div>
                            ) : (
                              <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 2 }}>
                                ⚠ Sin GPS registrado
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* ── WITHOUT GEO WARNING ── */}
        {!loading && withoutGeo.length > 0 && (
          <div className="alert alert-warn">
            <span className="alert-icon">⚠</span>
            <div className="alert-body">
              <div className="alert-title">
                {withoutGeo.length} registro{withoutGeo.length > 1 ? 's' : ''} sin geolocalización
              </div>
              <div className="alert-msg">
                {withoutGeo.map(r => r.profiles?.full_name).filter(Boolean).join(', ')} —
                El profesional puede tener el GPS desactivado o marcó asistencia sin conexión.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
