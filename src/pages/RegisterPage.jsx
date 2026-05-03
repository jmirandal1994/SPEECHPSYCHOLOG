import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ROLES    = ['Enfermera/o', 'TENS', 'Auxiliar de servicio', 'Administrativo']

export default function RegisterPage() {
  const [step, setStep] = useState('form') // form | success
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm] = useState({
    full_name:  '',
    email:      '',
    phone:      '',
    rut:        '',
    role_label: '',
    message:    '',
  })

  function field(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Check not already submitted
    const { data: existing } = await supabase
      .from('account_requests')
      .select('id, status')
      .eq('email', form.email)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'pending') {
        setError('Ya existe una solicitud pendiente con este correo. La administración la revisará pronto.')
      } else if (existing.status === 'approved') {
        setError('Este correo ya tiene una cuenta aprobada. Ve a iniciar sesión.')
      } else {
        setError('Este correo fue rechazado previamente. Contacta a la administración.')
      }
      setSaving(false)
      return
    }

    const { error: dbErr } = await supabase.from('account_requests').insert([{
      ...form,
      status: 'pending',
    }])

    if (dbErr) {
      setError('Ocurrió un error al enviar la solicitud. Intenta nuevamente.')
    } else {
      setStep('success')
    }
    setSaving(false)
  }

  if (step === 'success') return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="Speech Psychology" style={{ width: 80, height: 80, objectFit: 'contain', margin: '0 auto 16px', display: 'block', filter: 'drop-shadow(0 4px 20px rgba(59,130,246,0.4))' }} />

        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.03em' }}>
          Solicitud enviada
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 24 }}>
          Tu solicitud fue recibida exitosamente.<br />
          La administración la revisará y recibirás tus credenciales de acceso al correo <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{form.email}</strong> una vez aprobada.
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
          {[
            ['👤 Nombre', form.full_name],
            ['📧 Correo', form.email],
            ['💼 Cargo',  form.role_label || '—'],
            ['📱 Teléfono', form.phone || '—'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</span>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <Link to="/login" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', marginTop: 8 }}>
          ← Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ width: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.png" alt="Speech Psychology" style={{ width: 70, height: 70, objectFit: 'contain', display: 'block', margin: '0 auto 10px', filter: 'drop-shadow(0 4px 20px rgba(59,130,246,0.35))' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>Speech Psychology & CardioHome</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, letterSpacing: '.06em', textTransform: 'uppercase' }}>Solicitud de acceso al sistema</div>
        </div>

        <div style={{ background: 'rgba(29,78,216,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
          ℹ️ Completa el formulario y la administración revisará tu solicitud. Recibirás tus credenciales por correo una vez aprobada.
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Nombre y RUT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="auth-label">Nombre completo *</label>
              <input className="auth-input" required placeholder="María González" value={form.full_name} onChange={e => field('full_name', e.target.value)} />
            </div>
            <div>
              <label className="auth-label">RUT</label>
              <input className="auth-input" placeholder="12.345.678-9" value={form.rut} onChange={e => field('rut', e.target.value)} />
            </div>
          </div>

          {/* Email y teléfono */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="auth-label">Correo electrónico *</label>
              <input className="auth-input" type="email" required placeholder="nombre@ejemplo.cl" value={form.email} onChange={e => field('email', e.target.value)} />
            </div>
            <div>
              <label className="auth-label">Teléfono</label>
              <input className="auth-input" placeholder="+56 9 XXXX XXXX" value={form.phone} onChange={e => field('phone', e.target.value)} />
            </div>
          </div>

          {/* Cargo */}
          <label className="auth-label">Cargo / Especialidad *</label>
          <select className="auth-input" required value={form.role_label} onChange={e => field('role_label', e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="">Seleccionar cargo...</option>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>

          {/* Mensaje opcional */}
          <label className="auth-label">Mensaje (opcional)</label>
          <textarea
            className="auth-input"
            placeholder="Puedes agregar información adicional para la administración..."
            rows={3}
            value={form.message}
            onChange={e => field('message', e.target.value)}
            style={{ resize: 'none', lineHeight: 1.5 }}
          />

          <button className="auth-btn" type="submit" disabled={saving}>
            {saving ? 'Enviando solicitud...' : '📤 Enviar solicitud de acceso'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to="/login" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
            ← Ya tengo cuenta, iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
