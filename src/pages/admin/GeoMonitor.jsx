import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function GeoMonitor() {
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [selected, setSelected] = useState(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    loadData()
    injectLeaflet()
  }, [])

  function injectLeaflet() {
    if (document.getElementById('leaflet-css')) { initMap(); return }

    // CSS
    const css = document.createElement('link')
    css.id = 'leaflet-css'
    css.rel = 'stylesheet'
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(css)

    // JS
    const js = document.createElement('script')
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    js.onload = () => { setMapReady(true) }
    document.head.appendChild(js)
  }

  async function loadData() {
    const { data } = await supabase
      .from('attendances')
      .select('*, profiles(full_name, role_label, project)')
      .gte('checked_in_at', todayStr)
      .order('checked_in_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (mapReady && !leafletRef.current && mapRef.current) {
      initMap()
    }
  }, [mapReady, records])

  function initMap() {
    if (!window.L || !mapRef.current || leafletRef.current) return

    const L = window.L
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-33.45, -70.65], 11)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    leafletRef.current = map
    addMarkers(map, records)
  }

  function addMarkers(map, data) {
    const L = window.L
    if (!L) return

    // Clear existing markers
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer)
    })

    const bounds = []

    data.forEach(r => {
      if (r.checkin_lat && r.checkin_lng) {
        const color = r.status === 'late' ? '#f59e0b' : '#22c55e'
        const marker = L.circleMarker([r.checkin_lat, r.checkin_lng], {
          radius: 10,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map)

        const checkinTime = r.checked_in_at
          ? new Date(r.checked_in_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
          : '—'
        const checkoutTime = r.checked_out_at
          ? new Date(r.checked_out_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
          : 'Sin salida'

        marker.bindPopup(`
          <div style="font-family:system-ui;min-width:180px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${r.profiles?.full_name || '—'}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px">${r.profiles?.role_label || ''} · ${r.profiles?.project || ''}</div>
            <div style="font-size:12px"><b>Entrada:</b> ${checkinTime}</div>
            <div style="font-size:12px"><b>Salida:</b> ${checkoutTime}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:6px">${r.checkin_lat?.toFixed(5)}, ${r.checkin_lng?.toFixed(5)}</div>
            <div style="margin-top:8px">
              <span style="
                display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;
                background:${r.status === 'late' ? '#fef3c7' : '#d1fae5'};
                color:${r.status === 'late' ? '#92400e' : '#065f46'};
              ">${r.status === 'late' ? '⚠ Con atraso' : '✓ A tiempo'}</span>
            </div>
          </div>
        `, { maxWidth: 220 })

        bounds.push([r.checkin_lat, r.checkin_lng])
      }

      // Checkout marker if different location
      if (r.checkout_lat && r.checkout_lng) {
        L.circleMarker([r.checkout_lat, r.checkout_lng], {
          radius: 7,
          fillColor: '#6366f1',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        }).addTo(map).bindPopup(`
          <div style="font-family:system-ui">
            <div style="font-weight:700;font-size:12px">${r.profiles?.full_name} — Salida</div>
            <div style="font-size:11px">${r.checked_out_at ? new Date(r.checked_out_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
          </div>
        `)
        bounds.push([r.checkout_lat, r.checkout_lng])
      }
    })

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }
  }

  // When records load after map is ready
  useEffect(() => {
    if (leafletRef.current && records.length > 0) {
      addMarkers(leafletRef.current, records)
    }
  }, [records])

  const withGeo    = records.filter(r => r.checkin_lat)
  const withoutGeo = records.filter(r => !r.checkin_lat)

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">📍 Geolocalización</div>
          <div className="topbar-sub">Monitoreo de asistencia en tiempo real · {todayStr}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={loadData}>↻ Actualizar</button>
        </div>
      </div>

      <div className="content">
        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
          {[
            { label: 'Registros hoy', value: records.length, accent: 'accent-blue',  icon: '📋', ibg: 'var(--navy-200)', icl: 'var(--navy-700)' },
            { label: 'Con geoloc.',   value: withGeo.length,    accent: 'accent-green', icon: '📍', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)' },
            { label: 'A tiempo',      value: records.filter(r => r.status !== 'late').length, accent: 'accent-green', icon: '✔', ibg: 'var(--emerald-l)', icl: 'var(--emerald-d)' },
            { label: 'Con atraso',    value: records.filter(r => r.status === 'late').length, accent: 'accent-amber',  icon: '⚠', ibg: 'var(--amber-l)',   icl: 'var(--amber)' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-accent-bar ${s.accent}`} />
              <div className="stat-icon" style={{ background: s.ibg, color: s.icl }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{loading ? '—' : s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          {/* Map */}
          <div className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="card-title">Mapa de asistencia</div>
                <div className="card-sub">Entradas y salidas georreferenciadas hoy</div>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-4)' }}>
                <span>🟢 A tiempo</span>
                <span>🟡 Con atraso</span>
                <span>🟣 Salida</span>
              </div>
            </div>

            {loading ? (
              <div className="empty-state" style={{ height: 420 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : records.length === 0 ? (
              <div className="empty-state" style={{ height: 420 }}>
                <div className="empty-state-icon">🗺</div>
                <div className="empty-state-title">Sin registros georreferenciados hoy</div>
                <div className="empty-state-sub">Los marcadores aparecerán cuando los profesionales marquen asistencia</div>
              </div>
            ) : (
              <div ref={mapRef} style={{ height: 440, width: '100%' }} />
            )}
          </div>

          {/* List */}
          <div className="card" style={{ marginBottom: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div className="card-title">Registros de hoy</div>
              <div className="card-sub">{records.length} marcación{records.length !== 1 ? 'es' : ''}</div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div className="empty-state" style={{ padding: '32px 0' }}><div className="spinner" /></div>
              ) : records.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 16px' }}>
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">Sin registros</div>
                </div>
              ) : records.map((r, i) => {
                const checkinTime  = r.checked_in_at  ? new Date(r.checked_in_at).toLocaleTimeString('es-CL',  { hour: '2-digit', minute: '2-digit' }) : '—'
                const checkoutTime = r.checked_out_at ? new Date(r.checked_out_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : null
                const colors = [{ bg: '#dbeafe', col: '#1e3a8a' }, { bg: '#d1fae5', col: '#065f46' }, { bg: '#fef9c3', col: '#92400e' }, { bg: '#fce7f3', col: '#9d174d' }]
                const c = colors[i % colors.length]
                const ini = (r.profiles?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: r.checkin_lat ? 'pointer' : 'default',
                      background: selected === r.id ? 'var(--navy-50)' : undefined,
                      transition: 'background 0.15s',
                    }}
                    onClick={() => {
                      if (!r.checkin_lat || !leafletRef.current) return
                      setSelected(r.id)
                      leafletRef.current.flyTo([r.checkin_lat, r.checkin_lng], 16, { duration: 1 })
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{ini}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.profiles?.full_name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{r.profiles?.project || r.profiles?.role_label}</div>
                      </div>
                      <span className={`badge ${r.status === 'late' ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 10 }}>
                        {r.status === 'late' ? '⚠' : '✓'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                      <span style={{ color: 'var(--emerald)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>↑ {checkinTime}</span>
                      {checkoutTime && <span style={{ color: '#6366f1', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>↓ {checkoutTime}</span>}
                      {!r.checkin_lat && <span style={{ color: 'var(--text-4)' }}>Sin GPS</span>}
                    </div>
                    {r.checkin_lat && (
                      <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                        {r.checkin_lat.toFixed(4)}, {r.checkin_lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Workers without geo */}
        {withoutGeo.length > 0 && (
          <div className="alert alert-warn" style={{ marginTop: 14 }}>
            <span className="alert-icon">⚠</span>
            <div className="alert-body">
              <div className="alert-title">{withoutGeo.length} registro{withoutGeo.length > 1 ? 's' : ''} sin geolocalización</div>
              <div className="alert-msg">
                {withoutGeo.map(r => r.profiles?.full_name).filter(Boolean).join(', ')} — El profesional puede tener el GPS desactivado.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
