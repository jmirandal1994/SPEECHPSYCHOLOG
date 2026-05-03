import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function WorkerCheckin() {
  const { user, profile } = useAuth()
  const [step, setStep] = useState('idle') // idle | checkin | checkout | done
  const [time, setTime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState(null)

  async function doCheckin() {
    setLoading(true)
    const now = new Date()
    let lat = null, lng = null
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }))
      lat = pos.coords.latitude
      lng = pos.coords.longitude
      setLocation({ lat, lng })
    } catch {}

    await supabase.from('attendances').insert([{
      worker_id: user?.id,
      status: 'present',
      checked_in_at: now.toISOString(),
      checkin_lat: lat,
      checkin_lng: lng,
    }])

    setTime(now.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' }))
    setStep('checkin')
    setLoading(false)
  }

  async function doCheckout() {
    setLoading(true)
    const now = new Date()
    // update latest attendance for this worker today
    const today = new Date().toISOString().slice(0,10)
    await supabase.from('attendances')
      .update({ checked_out_at: now.toISOString() })
      .eq('worker_id', user?.id)
      .gte('checked_in_at', today)
      .order('checked_in_at', { ascending: false })
      .limit(1)

    setStep('done')
    setLoading(false)
  }

  return (
    <div className="page-enter">
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Marcar Asistencia</div>
          <div className="topbar-sub">Registro de entrada y salida</div>
        </div>
      </div>
      <div className="content">
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          {/* Shift info */}
          <div className="card" style={{ marginBottom: 20, background:'linear-gradient(135deg,var(--navy-800),var(--navy-900))', border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700 }}>Turno Actual</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'#fff', letterSpacing:'-0.03em' }}>
                  {profile?.project || 'CardioHome Sur'}
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>
                  08:00 – 20:00 &nbsp;·&nbsp; 15 de mayo 2025
                </div>
              </div>
              <div style={{ fontSize:40 }}>🏥</div>
            </div>
          </div>

          {/* Step: idle */}
          {step === 'idle' && (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:56, marginBottom:16 }}>📍</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--text-1)', marginBottom:8 }}>
                ¿Listo para comenzar?
              </div>
              <div style={{ fontSize:13, color:'var(--text-4)', marginBottom:28, lineHeight:1.6 }}>
                Se registrará tu ubicación GPS al marcar la entrada.<br/>
                Asegúrate de estar en el lugar asignado.
              </div>
              <button className="btn btn-primary" style={{ padding:'14px 32px', fontSize:15 }} onClick={doCheckin} disabled={loading}>
                {loading ? 'Registrando...' : '📍 Marcar entrada'}
              </button>
            </div>
          )}

          {/* Step: checked in */}
          {step === 'checkin' && (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ width:64, height:64, background:'var(--emerald-l)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>✓</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--emerald-d)', marginBottom:6 }}>
                ¡Entrada registrada!
              </div>
              <div style={{ fontSize:28, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--text-1)', margin:'12px 0' }}>{time}</div>
              {location && (
                <div style={{ fontSize:12, color:'var(--text-4)', marginBottom:20 }}>
                  📍 Lat: {location.lat.toFixed(4)} · Lng: {location.lng.toFixed(4)}
                </div>
              )}
              <div className="alert alert-success" style={{ textAlign:'left', margin:'0 0 20px' }}>
                <span className="alert-icon">ℹ</span>
                <div className="alert-body">
                  <div className="alert-msg">Tu entrada fue registrada con éxito. Marca la salida al finalizar tu turno.</div>
                </div>
              </div>
              <button className="btn btn-danger" style={{ padding:'12px 28px' }} onClick={doCheckout} disabled={loading}>
                {loading ? 'Registrando...' : '🚪 Marcar salida'}
              </button>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--text-1)', marginBottom:8 }}>
                Turno finalizado
              </div>
              <div style={{ fontSize:13, color:'var(--text-4)', marginBottom:24 }}>
                Tu asistencia ha sido registrada correctamente. ¡Hasta el próximo turno!
              </div>
              <button className="btn btn-ghost" onClick={() => setStep('idle')}>← Volver</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
