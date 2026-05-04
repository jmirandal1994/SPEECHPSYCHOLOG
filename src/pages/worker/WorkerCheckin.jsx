import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function WorkerCheckin() {
  const { user, profile } = useAuth()
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)

  const [step, setStep]           = useState('idle') // idle | confirm-location | getting-gps | active | checkout-confirm | done | blocked
  const [attendance, setAttendance] = useState(null)
  const [todayShift, setTodayShift] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [geoError, setGeoError]   = useState('')
  const [elapsed, setElapsed]     = useState(0)
  const [checkoutConfirm, setCheckoutConfirm] = useState(false)

  const now      = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const dateLabel = `${now.getDate()} de ${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  useEffect(() => {
    if (user) { checkExisting(); loadLeaflet() }
  }, [user])

  // Timer
  useEffect(() => {
    if (!attendance?.checked_in_at || attendance?.checked_out_at) return
    const start = new Date(attendance.checked_in_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [attendance])

  async function checkExisting() {
    setLoading(true)

    // Check today's shift
    const { data: shift } = await supabase
      .from('shifts').select('*').eq('worker_id', user.id).eq('shift_date', todayStr).maybeSingle()
    setTodayShift(shift)

    // Check today's attendance — ONE per day max
    const { data: att } = await supabase
      .from('attendances').select('*').eq('worker_id', user.id)
      .gte('checked_in_at', todayStr + 'T00:00:00')
      .lte('checked_in_at', todayStr + 'T23:59:59')
      .maybeSingle()

    if (att) {
      setAttendance(att)
      setStep(att.checked_out_at ? 'done' : 'active')
      if (att.checkin_lat && !att.checked_out_at) initMap(att.checkin_lat, att.checkin_lng, '#22c55e', 'Mi entrada')
      if (att.checkout_lat && att.checked_out_at) initMap(att.checkout_lat, att.checkout_lng, '#6366f1', 'Mi salida')
    } else if (!shift) {
      setStep('no-shift') // no shift assigned for today
    } else {
      setStep('idle')
    }
    setLoading(false)
  }

  function loadLeaflet() {
    if (window.L || document.getElementById('leaflet-js')) return
    const css = document.createElement('link')
    css.id = 'leaflet-css'; css.rel = 'stylesheet'
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.id = 'leaflet-js'
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    document.head.appendChild(js)
  }

  function initMap(lat, lng, color, label) {
    setTimeout(() => {
      if (!window.L || !mapRef.current) return
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null }
      const L = window.L
      const map = L.map(mapRef.current, { zoomControl: false }).setView([lat, lng], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      L.divIcon && L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="width:34px;height:34px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 34],
        })
      }).addTo(map).bindPopup(label).openPopup()
      L.circle([lat, lng], { radius: 50, fillColor: color, fillOpacity: 0.1, color, weight: 1 }).addTo(map)
      leafletRef.current = map
    }, 400)
  }

  async function getGPS() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS no disponible')); return }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        err => {
          const m = { 1: 'Permiso GPS denegado. Actívalo en Configuración.', 2: 'No se pudo obtener ubicación.', 3: 'Tiempo agotado. Intenta de nuevo.' }
          reject(new Error(m[err.code] || 'Error GPS'))
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      )
    })
  }

  function handleCheckinPress() { setStep('confirm-location') }

  async function confirmAndCheckin() {
    setStep('getting-gps')
    setSaving(true)
    setGeoError('')

    let lat = null, lng = null
    try { const p = await getGPS(); lat = p.lat; lng = p.lng }
    catch (err) { setGeoError(err.message) }

    let status = 'present', lateMinutes = 0
    if (todayShift?.start_time) {
      const [h, m] = todayShift.start_time.split(':').map(Number)
      const shiftStart = new Date(now)
      shiftStart.setHours(h, m + 5, 0, 0)
      if (now > shiftStart) { status = 'late'; lateMinutes = Math.floor((now - shiftStart) / 60000) }
    }

    const { data: newAtt } = await supabase.from('attendances').insert([{
      worker_id: user.id,
      shift_id:  todayShift?.id || null,
      status, late_minutes: lateMinutes,
      checked_in_at: now.toISOString(),
      checkin_lat: lat, checkin_lng: lng,
    }]).select().single()

    setAttendance(newAtt)
    setStep('active')
    if (lat) initMap(lat, lng, '#22c55e', 'Mi entrada')
    setSaving(false)
  }

  async function doCheckout() {
    setSaving(true)
    setGeoError('')
    let lat = null, lng = null
    try { const p = await getGPS(); lat = p.lat; lng = p.lng }
    catch (err) { setGeoError(err.message) }

    const { data: updated } = await supabase
      .from('attendances')
      .update({ checked_out_at: new Date().toISOString(), checkout_lat: lat, checkout_lng: lng })
      .eq('id', attendance.id).select().single()

    // Auto-complete shift
    if (todayShift?.id) {
      await supabase.from('shifts').update({ status: 'completed' }).eq('id', todayShift.id)
    }

    setAttendance(updated)
    setStep('done')
    setCheckoutConfirm(false)
    if (lat) initMap(lat, lng, '#6366f1', 'Mi salida')
    setSaving(false)
  }

  const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'
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
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Marcar Asistencia</div>
          <div className="topbar-sub">{dateLabel}</div>
        </div>
      </div>

      <div className="content">
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

          {/* Shift header */}
          <div className="card" style={{ background: 'linear-gradient(135deg,var(--navy-800),var(--navy-900))', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 4 }}>
                  {todayShift ? `Turno · ${todayShift.start_time} – ${todayShift.end_time}` : 'Hoy'}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                  {profile?.project || todayShift?.project || 'Sin proyecto asignado'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                  {firstName} · {profile?.role_label}
                </div>
              </div>
              {step === 'active' && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: '#22c55e' }}>{fmtElapsed()}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>● En turno</div>
                </div>
              )}
            </div>
          </div>

          {geoError && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              <span className="alert-icon">📡</span>
              <div className="alert-body">
                <div className="alert-title">Sin GPS</div>
                <div className="alert-msg">{geoError} — Asistencia registrada sin coordenadas.</div>
              </div>
            </div>
          )}

          {/* ── NO SHIFT TODAY ── */}
          {step === 'no-shift' && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
                Sin turno asignado hoy
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-4)', lineHeight: 1.6 }}>
                No tienes turno programado para hoy.<br />
                Si crees que es un error, contacta a la administración.
              </div>
            </div>
          )}

          {/* ── IDLE ── */}
          {step === 'idle' && (
            <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <div style={{ fontSize: 60, marginBottom: 16, lineHeight: 1 }}>🏥</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                ¡Hola, {firstName}!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 8, lineHeight: 1.6 }}>
                Turno de hoy: <strong style={{ color: 'var(--text-1)' }}>{todayShift?.start_time} – {todayShift?.end_time}</strong>
              </div>
              {todayShift?.fee && (
                <div style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 700, marginBottom: 24 }}>
                  💰 Honorario: ${Number(todayShift.fee).toLocaleString('es-CL')} CLP
                </div>
              )}
              <div style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 24, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
                🔒 Se registrará tu ubicación GPS al marcar entrada.<br />
                Solo visible para administración.
              </div>
              <button
                className="checkin-btn-primary"
                style={{ background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff', boxShadow: '0 6px 24px rgba(5,150,105,0.4)' }}
                onClick={handleCheckinPress}
              >
                <span style={{ fontSize: 22 }}>📍</span> Marcar entrada
              </button>
            </div>
          )}

          {/* ── CONFIRM LOCATION ── */}
          {step === 'confirm-location' && (
            <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 18px', boxShadow: '0 8px 24px rgba(245,158,11,0.4)' }}>⚠️</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>
                ¿Estás en el lugar de trabajo?
              </div>
              <div style={{ background: 'var(--amber-l)', border: '1px solid #fde68a', borderRadius: 'var(--r-md)', padding: '16px 18px', marginBottom: 22, textAlign: 'left' }}>
                <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7, fontWeight: 500 }}>
                  📍 <strong>Debes estar físicamente en el lugar asignado</strong> para marcar tu entrada.
                </div>
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 8, lineHeight: 1.6 }}>
                  Tu ubicación GPS será registrada. Si marcas desde otro lugar, <strong>la administración será notificada y se contactará contigo.</strong>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 18 }}>
                Proyecto: <span style={{ color: 'var(--accent)' }}>{profile?.project || todayShift?.project || '—'}</span>
              </div>
              <button
                className="checkin-btn-primary"
                style={{ background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff', boxShadow: '0 6px 24px rgba(5,150,105,0.4)', marginBottom: 10 }}
                onClick={confirmAndCheckin} disabled={saving}
              >
                <span style={{ fontSize: 20 }}>✅</span> Sí, estoy aquí — Confirmar entrada
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setStep('idle')} disabled={saving}>
                ← Cancelar
              </button>
            </div>
          )}

          {/* ── GETTING GPS ── */}
          {step === 'getting-gps' && (
            <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
              <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3, marginBottom: 20 }} />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', marginBottom: 6 }}>Obteniendo ubicación...</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Mantén el GPS activado</div>
            </div>
          )}

          {/* ── ACTIVE ── */}
          {step === 'active' && attendance && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--emerald-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>✅</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--emerald-d)' }}>Entrada registrada</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                    {fmtTime(attendance.checked_in_at)} · {attendance.status === 'late' ? '⚠️ Con atraso' : '✓ A tiempo'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  ['📍 Entrada', fmtTime(attendance.checked_in_at)],
                  ['⏱ En turno', fmtElapsed()],
                  ['💰 Honorario', todayShift?.fee ? `$${Number(todayShift.fee).toLocaleString('es-CL')}` : '—'],
                  ['📅 Turno', `${todayShift?.start_time || '—'} – ${todayShift?.end_time || '—'}`],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--slate-50)', borderRadius: 'var(--r)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{v}</div>
                  </div>
                ))}
              </div>

              {attendance.checkin_lat && (
                <div ref={mapRef} style={{ height: 180, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }} />
              )}

              {!checkoutConfirm ? (
                <button
                  className="checkin-btn-primary"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', boxShadow: '0 6px 24px rgba(220,38,38,0.35)' }}
                  onClick={() => setCheckoutConfirm(true)}
                >
                  <span style={{ fontSize: 20 }}>🚪</span> Marcar salida
                </button>
              ) : (
                <div style={{ background: 'var(--red-l)', border: '1px solid #fca5a5', borderRadius: 'var(--r-md)', padding: '18px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>¿Confirmar salida?</div>
                  <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 16, lineHeight: 1.6 }}>
                    Se registrará tu ubicación y se cerrará el turno de hoy.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="checkin-btn-primary"
                      style={{ flex: 1, background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', minHeight: 46, fontSize: 14 }}
                      onClick={doCheckout} disabled={saving}
                    >
                      {saving ? '⏳ Registrando...' : '✓ Confirmar salida'}
                    </button>
                    <button className="btn" onClick={() => setCheckoutConfirm(false)} disabled={saving}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--navy-50)', border: '1px solid var(--navy-200)', borderRadius: 'var(--r)', padding: '12px 14px', fontSize: 12, color: 'var(--navy-700)', lineHeight: 1.6, marginTop: 14 }}>
                ℹ️ Presiona <strong>Marcar salida</strong> solo al finalizar tu turno. Se te pedirá confirmar.
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && attendance && (
            <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                ¡Turno completado!
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 32, margin: '20px 0' }}>
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
              {todayShift?.fee && (
                <div style={{ background: 'var(--emerald-l)', border: '1px solid #6ee7b7', borderRadius: 'var(--r)', padding: '12px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: 'var(--emerald-d)' }}>
                  💰 Honorario del día: ${Number(todayShift.fee).toLocaleString('es-CL')} CLP
                </div>
              )}
              {attendance.checkout_lat && (
                <div ref={mapRef} style={{ height: 160, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }} />
              )}
              <div style={{ background: 'var(--navy-50)', border: '1px solid var(--navy-200)', borderRadius: 'var(--r)', padding: '14px', fontSize: 13, color: 'var(--navy-700)', lineHeight: 1.7 }}>
                <strong>El marcaje del próximo día se habilitará automáticamente mañana.</strong><br />
                <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Solo puedes registrar una asistencia por día.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
