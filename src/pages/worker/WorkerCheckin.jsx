import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function WorkerCheckin() {
  const { user, profile } = useAuth()
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)

  // step: idle | confirm-location | getting-gps | active | checkout-confirm | done
  const [step, setStep]         = useState('idle')
  const [attendance, setAttendance] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [geoError, setGeoError] = useState('')
  const [elapsed, setElapsed]   = useState(0)
  const [checkoutConfirm, setCheckoutConfirm] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (user) checkExisting()
    loadLeaflet()
  }, [user])

  // Live timer
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
      setStep(data.checked_out_at ? 'done' : 'active')
      if (data.checkin_lat && !data.checked_out_at) initMap(data.checkin_lat, data.checkin_lng, '#22c55e', 'Mi entrada')
      if (data.checkout_lat && data.checked_out_at) initMap(data.checkout_lat, data.checkout_lng, '#6366f1', 'Mi salida')
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

  function initMap(lat, lng, color, label) {
    setTimeout(() => {
      if (!window.L || !mapRef.current) return
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null }
      const L   = window.L
      const map = L.map(mapRef.current, { zoomControl: false }).setView([lat, lng], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(map)
      const icon = L.divIcon({
        html: `<div style="width:34px;height:34px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>`,
        className: '', iconSize: [34, 34], iconAnchor: [17, 17],
      })
      L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${label}</b>`).openPopup()
      L.circle([lat, lng], { radius: 60, fillColor: color, fillOpacity: 0.1, color, weight: 1 }).addTo(map)
      leafletRef.current = map
    }, 400)
  }

  async function getGPS() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS no disponible')); return }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        err => {
          const msgs = { 1: 'Permiso GPS denegado. Actívalo en configuración.', 2: 'No se pudo obtener ubicación.', 3: 'Tiempo agotado. Intenta de nuevo.' }
          reject(new Error(msgs[err.code] || 'Error GPS'))
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      )
    })
  }

  // Step 1 — user clicks "Marcar entrada" → show location alert first
  function handleCheckinPress() {
    setStep('confirm-location')
  }

  // Step 2 — user confirms they are in the right place → get GPS and save
  async function confirmAndCheckin() {
    setStep('getting-gps')
    setSaving(true)
    setGeoError('')

    let lat = null, lng = null
    try {
      const pos = await getGPS()
      lat = pos.lat; lng = pos.lng
    } catch (err) {
      setGeoError(err.message)
    }

    const now = new Date()

    // Check if late vs shift start
    const { data: shift } = await supabase
      .from('shifts').select('start_time')
      .eq('worker_id', user.id).eq('shift_date', todayStr).maybeSingle()

    let status = 'present', lateMinutes = 0
    if (shift?.start_time) {
      const [h, m] = shift.start_time.split(':').map(Number)
      const shiftStart = new Date(now)
      shiftStart.setHours(h, m + 5, 0, 0)
      if (now > shiftStart) {
        status = 'late'
        lateMinutes = Math.floor((now - shiftStart) / 60000)
      }
    }

    const { data: newAtt } = await supabase.from('attendances').insert([{
      worker_id:     user.id,
      status,
      late_minutes:  lateMinutes,
      checked_in_at: now.toISOString(),
      checkin_lat:   lat,
      checkin_lng:   lng,
    }]).select().single()

    setAttendance(newAtt)
    setStep('active')
    if (lat) initMap(lat, lng, '#22c55e', 'Mi entrada')
    setSaving(false)
  }

  // Checkout — only after user explicitly confirms
  async function doCheckout() {
    setSaving(true)
    setGeoError('')

    let lat = null, lng = null
    try {
      const pos = await getGPS()
      lat = pos.lat; lng = pos.lng
    } catch (err) {
      setGeoError(err.message)
    }

    const { data: updated } = await supabase
      .from('attendances')
      .update({ checked_out_at: new Date().toISOString(), checkout_lat: lat, checkout_lng: lng })
      .eq('id', attendance.id)
      .select().single()

    setAttendance(updated)
    setStep('done')
    setCheckoutConfirm(false)
    if (lat) initMap(lat, lng, '#6366f1', 'Mi salida')
    setSaving(false)
  }

  const fmtTime = ts => ts
    ? new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const fmtElapsed = () => {
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
    const s = String(elapsed % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Profesional'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="page-enter">
      {/* Desktop topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Marcar Asistencia</div>
          <div className="topbar-sub">Registro con geolocalización · {todayStr}</div>
        </div>
      </div>

      <div className="content">
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

          {/* Header card — shift info */}
          <div className="card" style={{ background: 'linear-gradient(135deg,var(--navy-800),var(--navy-900))', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 4 }}>Turno · {todayStr}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                  {profile?.project || 'Sin proyecto asignado'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                  {profile?.full_name} · {profile?.role_label}
                </div>
              </div>
              {step === 'active' && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: '#22c55e', letterSpacing: '-0.02em' }}>{fmtElapsed()}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>● En turno</div>
                </div>
              )}
            </div>
          </div>

          {/* GPS error */}
          {geoError && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              <span className="alert-icon">📡</span>
              <div className="alert-body">
                <div className="alert-title">Sin GPS</div>
                <div className="alert-msg">{geoError} — La asistencia se registró sin coordenadas.</div>
              </div>
            </div>
          )}

          {/* ── IDLE — big checkin button ── */}
          {step === 'idle' && (
            <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>🏥</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
                ¡Buenos días, {firstName}!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 28, lineHeight: 1.6 }}>
                ¿Listo para comenzar tu turno?<br />
                Se registrará tu ubicación GPS al marcar entrada.
              </div>
              <button
                className="checkin-btn-primary"
                style={{ background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff', boxShadow: '0 6px 24px rgba(5,150,105,0.4)', marginBottom: 12 }}
                onClick={handleCheckinPress}
              >
                <span style={{ fontSize: 22 }}>📍</span>
                Marcar entrada
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8 }}>
                🔒 Tu ubicación es privada — solo visible para administración
              </div>
            </div>
          )}

          {/* ── CONFIRM LOCATION ALERT ── */}
          {step === 'confirm-location' && (
            <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              {/* Big warning icon */}
              <div style={{
                width: 72, height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34, margin: '0 auto 18px',
                boxShadow: '0 8px 24px rgba(245,158,11,0.4)',
              }}>⚠️</div>

              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginBottom: 10, letterSpacing: '-0.03em' }}>
                ¿Estás en el lugar de trabajo?
              </div>

              <div style={{
                background: 'var(--amber-l)',
                border: '1px solid #fde68a',
                borderRadius: 'var(--r-md)',
                padding: '16px 18px',
                marginBottom: 24,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7, fontWeight: 500 }}>
                  📍 <strong>Debes estar físicamente en el lugar de trabajo asignado</strong> para marcar tu entrada.
                </div>
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 8, lineHeight: 1.6 }}>
                  Tu ubicación GPS será registrada. Si marcas entrada desde un lugar diferente al asignado,
                  <strong> la administración será notificada y se contactará contigo.</strong>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>
                Proyecto asignado: <span style={{ color: 'var(--accent)' }}>{profile?.project || 'Consulta con administración'}</span>
              </div>

              <button
                className="checkin-btn-primary"
                style={{ background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff', boxShadow: '0 6px 24px rgba(5,150,105,0.4)', marginBottom: 10 }}
                onClick={confirmAndCheckin}
                disabled={saving}
              >
                <span style={{ fontSize: 20 }}>✅</span>
                Sí, estoy en el lugar — Confirmar entrada
              </button>

              <button
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                onClick={() => setStep('idle')}
                disabled={saving}
              >
                ← Cancelar
              </button>
            </div>
          )}

          {/* ── GETTING GPS ── */}
          {step === 'getting-gps' && (
            <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
              <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3, marginBottom: 20 }} />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', marginBottom: 6 }}>
                Obteniendo tu ubicación...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Mantén el GPS activado</div>
            </div>
          )}

          {/* ── ACTIVE — in shift ── */}
          {step === 'active' && attendance && (
            <>
              {/* Status */}
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--emerald-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>✅</div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--emerald-d)' }}>
                      Entrada registrada
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                      {fmtTime(attendance.checked_in_at)} · {attendance.status === 'late' ? '⚠️ Con atraso' : '✓ A tiempo'}
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  {[
                    ['📍 Entrada', fmtTime(attendance.checked_in_at)],
                    ['⏱ En turno', fmtElapsed()],
                    ['📡 GPS', attendance.checkin_lat ? `${attendance.checkin_lat.toFixed(4)}, ${attendance.checkin_lng.toFixed(4)}` : 'Sin datos'],
                    ['📅 Fecha', todayStr],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Map */}
                {attendance.checkin_lat && (
                  <div ref={mapRef} style={{ height: 180, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 18 }} />
                )}

                {/* Checkout button — shows confirm dialog first */}
                {!checkoutConfirm ? (
                  <button
                    className="checkin-btn-primary"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', boxShadow: '0 6px 24px rgba(220,38,38,0.35)' }}
                    onClick={() => setCheckoutConfirm(true)}
                  >
                    <span style={{ fontSize: 20 }}>🚪</span>
                    Marcar salida
                  </button>
                ) : (
                  /* Confirm dialog */
                  <div style={{ background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r-md)', padding: '18px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
                      ¿Confirmar salida?
                    </div>
                    <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 16, lineHeight: 1.6 }}>
                      Se registrará tu ubicación GPS de salida y se cerrará tu turno de hoy.
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        className="checkin-btn-primary"
                        style={{ flex: 1, background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', minHeight: 48, fontSize: 14 }}
                        onClick={doCheckout}
                        disabled={saving}
                      >
                        {saving ? '⏳ Registrando...' : '✓ Sí, confirmar salida'}
                      </button>
                      <button
                        className="btn"
                        style={{ flexShrink: 0 }}
                        onClick={() => setCheckoutConfirm(false)}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--navy-50)', border: '1px solid var(--navy-200)', borderRadius: 'var(--r)', padding: '12px 14px', fontSize: 12, color: 'var(--navy-700)', lineHeight: 1.6 }}>
                ℹ️ Presiona <strong>Marcar salida</strong> solo cuando termines tu turno. Se te pedirá confirmar antes de registrar.
              </div>
            </>
          )}

          {/* ── DONE ── */}
          {step === 'done' && attendance && (
            <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                Turno completado
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 24 }}>
                ¡Excelente trabajo hoy!
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 4 }}>Entrada</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: 'var(--emerald)' }}>{fmtTime(attendance.checked_in_at)}</div>
                </div>
                <div style={{ fontSize: 28, color: 'var(--text-4)', alignSelf: 'center' }}>→</div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 4 }}>Salida</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: '#6366f1' }}>{fmtTime(attendance.checked_out_at)}</div>
                </div>
              </div>

              {/* Map of checkout location */}
              {attendance.checkout_lat && (
                <div ref={mapRef} style={{ height: 160, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }} />
              )}

              <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>
                Tu asistencia fue registrada. Hasta el próximo turno 👋
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
