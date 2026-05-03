import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function WorkerCheckin() {
  const { user, profile } = useAuth()
  const mapRef        = useRef(null)
  const leafletRef    = useRef(null)
  const [attendance, setAttendance] = useState(null)  // today's open attendance
  const [step, setStep]   = useState('idle')           // idle | getting-location | checkin | checkout | done
  const [location, setLocation]   = useState(null)
  const [geoError, setGeoError]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [elapsed, setElapsed]     = useState(0)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (user) checkExisting()
    loadLeaflet()
  }, [user])

  // Timer while checked in
  useEffect(() => {
    if (!attendance?.checked_in_at || attendance?.checked_out_at) return
    const start = new Date(attendance.checked_in_at).getTime()
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [attendance])

  async function checkExisting() {
    setLoading(true)
    const { data } = await supabase
      .from('attendances')
      .select('*')
      .eq('worker_id', user.id)
      .gte('checked_in_at', todayStr)
      .maybeSingle()

    if (data) {
      setAttendance(data)
      setStep(data.checked_out_at ? 'done' : 'checkin')
    } else {
      setStep('idle')
    }
    setLoading(false)
  }

  function loadLeaflet() {
    if (document.getElementById('leaflet-css')) return
    const css = document.createElement('link')
    css.id = 'leaflet-css'
    css.rel = 'stylesheet'
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(css)

    const js = document.createElement('script')
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    document.head.appendChild(js)
  }

  function initMap(lat, lng, color = '#22c55e', label = 'Entrada') {
    setTimeout(() => {
      if (!window.L || !mapRef.current) return
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null }

      const L = window.L
      const map = L.map(mapRef.current).setView([lat, lng], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)

      const icon = L.divIcon({
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:${color};border:3px solid #fff;
          box-shadow:0 2px 12px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
        ">📍</div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      })

      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${label}</b><br>${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        .openPopup()

      // Accuracy circle
      L.circle([lat, lng], { radius: 50, fillColor: color, fillOpacity: 0.1, color, weight: 1 }).addTo(map)

      leafletRef.current = map
    }, 300)
  }

  async function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS no disponible en este dispositivo')); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        err => {
          const msgs = {
            1: 'Permiso de ubicación denegado. Activa el GPS en tu navegador.',
            2: 'No se pudo obtener la ubicación. Verifica tu conexión GPS.',
            3: 'Tiempo agotado. Intenta nuevamente en un lugar con mejor señal.',
          }
          reject(new Error(msgs[err.code] || 'Error al obtener ubicación'))
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      )
    })
  }

  async function doCheckin() {
    setSaving(true)
    setGeoError('')
    setStep('getting-location')

    let lat = null, lng = null, accuracy = null
    try {
      const pos = await getLocation()
      lat = pos.lat; lng = pos.lng; accuracy = pos.accuracy
      setLocation(pos)
    } catch (err) {
      setGeoError(err.message)
    }

    const now = new Date()

    // Determine if late (compare with shift start)
    const { data: shift } = await supabase
      .from('shifts')
      .select('start_time')
      .eq('worker_id', user.id)
      .eq('shift_date', todayStr)
      .maybeSingle()

    let status = 'present'
    let lateMinutes = 0
    if (shift?.start_time) {
      const [h, m] = shift.start_time.split(':').map(Number)
      const shiftStart = new Date(now)
      shiftStart.setHours(h, m + 5, 0, 0) // 5 min tolerance
      if (now > shiftStart) {
        status = 'late'
        lateMinutes = Math.floor((now - shiftStart) / 60000)
      }
    }

    const { data: newAtt, error } = await supabase.from('attendances').insert([{
      worker_id:      user.id,
      status,
      late_minutes:   lateMinutes,
      checked_in_at:  now.toISOString(),
      checkin_lat:    lat,
      checkin_lng:    lng,
    }]).select().single()

    if (!error && newAtt) {
      setAttendance(newAtt)
      setStep('checkin')
      if (lat) initMap(lat, lng, '#22c55e', 'Mi entrada')
    }
    setSaving(false)
  }

  async function doCheckout() {
    setSaving(true)
    setGeoError('')

    let lat = null, lng = null
    try {
      const pos = await getLocation()
      lat = pos.lat; lng = pos.lng
    } catch (err) {
      setGeoError(err.message)
    }

    const { data: updated } = await supabase
      .from('attendances')
      .update({ checked_out_at: new Date().toISOString(), checkout_lat: lat, checkout_lng: lng })
      .eq('id', attendance.id)
      .select()
      .single()

    if (updated) {
      setAttendance(updated)
      setStep('done')
      if (lat) initMap(lat, lng, '#6366f1', 'Mi salida')
    }
    setSaving(false)
  }

  const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'
  const fmtElapsed = () => {
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
    const s = String(elapsed % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  if (loading) return (
    <div className="page-enter">
      <div className="topbar"><div className="topbar-left"><div className="topbar-title">Marcar Asistencia</div></div></div>
      <div className="content"><div className="empty-state" style={{ marginTop: 60 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div></div>
    </div>
  )

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Marcar Asistencia</div>
          <div className="topbar-sub">Registro con geolocalización · {todayStr}</div>
        </div>
      </div>

      <div className="content">
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          {/* Shift info card */}
          <div className="card" style={{ background: 'linear-gradient(135deg,var(--navy-800),var(--navy-900))', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 4 }}>Turno actual</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                  {profile?.project || 'Sin proyecto asignado'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  {profile?.full_name} · {profile?.role_label}
                </div>
              </div>
              {step === 'checkin' && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: '#fff' }}>{fmtElapsed()}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>En turno</div>
                </div>
              )}
            </div>
          </div>

          {/* Geo error */}
          {geoError && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              <span className="alert-icon">⚠</span>
              <div className="alert-body">
                <div className="alert-title">Sin geolocalización</div>
                <div className="alert-msg">{geoError} — La asistencia se registrará sin coordenadas GPS.</div>
              </div>
            </div>
          )}

          {/* IDLE */}
          {step === 'idle' && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📍</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
                ¿Listo para comenzar tu turno?
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 28, lineHeight: 1.6 }}>
                Se registrará tu ubicación GPS al marcar entrada.<br />
                Asegúrate de estar en el lugar asignado.
              </div>
              <div style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 24, fontSize: 12, color: 'var(--text-3)' }}>
                🔒 Tu ubicación es privada y solo visible para administración.
              </div>
              <button
                className="btn btn-primary"
                style={{ padding: '14px 36px', fontSize: 15, width: '100%', justifyContent: 'center' }}
                onClick={doCheckin}
                disabled={saving}
              >
                {saving || step === 'getting-location' ? '📡 Obteniendo ubicación...' : '📍 Marcar entrada'}
              </button>
            </div>
          )}

          {/* GETTING LOCATION */}
          {step === 'getting-location' && (
            <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <div className="spinner" style={{ width: 40, height: 40, marginBottom: 16 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>Obteniendo tu ubicación GPS...</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>Mantén el GPS activado</div>
            </div>
          )}

          {/* CHECKED IN */}
          {step === 'checkin' && attendance && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--emerald-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✓</div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--emerald-d)' }}>Entrada registrada</div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                      {fmtTime(attendance.checked_in_at)} · {attendance.status === 'late' ? '⚠ Con atraso' : 'A tiempo ✓'}
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  {[
                    ['📍 Entrada', fmtTime(attendance.checked_in_at)],
                    ['⏱ En turno', fmtElapsed()],
                    attendance.checkin_lat
                      ? ['🌍 Lat', attendance.checkin_lat.toFixed(5)]
                      : ['📡 GPS', 'Sin datos'],
                    attendance.checkin_lng
                      ? ['🌍 Lng', attendance.checkin_lng.toFixed(5)]
                      : ['', ''],
                  ].map(([l, v], i) => l ? (
                    <div key={i} style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{v}</div>
                    </div>
                  ) : null)}
                </div>

                {/* Mini map */}
                {attendance.checkin_lat && (
                  <div ref={mapRef} style={{ height: 200, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 18 }} />
                )}

                <button
                  className="btn btn-danger"
                  style={{ width: '100%', justifyContent: 'center', padding: 13 }}
                  onClick={doCheckout}
                  disabled={saving}
                >
                  {saving ? '📡 Registrando salida...' : '🚪 Marcar salida'}
                </button>
              </div>
            </>
          )}

          {/* DONE */}
          {step === 'done' && attendance && (
            <div className="card" style={{ textAlign: 'center', padding: '36px 32px' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
                Turno finalizado
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, margin: '18px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 4 }}>Entrada</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, color: 'var(--emerald)' }}>{fmtTime(attendance.checked_in_at)}</div>
                </div>
                <div style={{ fontSize: 24, color: 'var(--text-4)', alignSelf: 'center' }}>→</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 4 }}>Salida</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, color: '#6366f1' }}>{fmtTime(attendance.checked_out_at)}</div>
                </div>
              </div>

              {attendance.checkout_lat && (
                <div ref={mapRef} style={{ height: 180, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', margin: '14px 0' }} />
              )}

              <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Tu asistencia fue registrada. ¡Hasta el próximo turno!</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
