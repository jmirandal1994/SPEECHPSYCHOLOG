import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ROLES = ['Enfermera/o', 'TENS', 'Auxiliar de servicio', 'Administrativo']

export default function RegisterPage() {
  const [step, setStep]       = useState('form') // form | success
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  const [form, setForm] = useState({
    full_name:  '',
    email:      '',
    password:   '',
    password2:  '',
    phone:      '',
    rut:        '',
    role_label: '',
  })

  function field(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function pwdStrength(pwd) {
    if (!pwd) return { score: 0, label: '', color: 'transparent' }
    let s = 0
    if (pwd.length >= 8)           s++
    if (pwd.length >= 12)          s++
    if (/[A-Z]/.test(pwd))         s++
    if (/[0-9]/.test(pwd))         s++
    if (/[^a-zA-Z0-9]/.test(pwd))  s++
    const map = [
      { label: '',          color: 'transparent' },
      { label: 'Muy débil', color: '#dc2626' },
      { label: 'Débil',     color: '#f59e0b' },
      { label: 'Regular',   color: '#f59e0b' },
      { label: 'Buena',     color: '#22c55e' },
      { label: 'Excelente', color: '#22c55e' },
    ]
    return { score: s, ...map[Math.min(s, 5)] }
  }

  const strength = pwdStrength(form.password)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.password2) { setError('Las contraseñas no coinciden.'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }

    setSaving(true)

    // Check if already requested
    const { data: existing } = await supabase
      .from('account_requests')
      .select('id, status')
      .eq('email', form.email)
      .maybeSingle()

    if (existing) {
      const msgs = {
        pending:  'Ya tienes una solicitud pendiente. Vuelve a intentar en unos minutos.',
        approved: 'Tu cuenta ya fue aprobada. Ve a iniciar sesión.',
        rejected: 'Este correo fue rechazado. Contacta a la administración.',
      }
      setError(msgs[existing.status] || 'Ya existe una solicitud con este correo.')
      setSaving(false)
      return
    }

    // Save request — password stored so admin can create the account on approval
    const { error: dbErr } = await supabase.from('account_requests').insert([{
      full_name:  form.full_name,
      email:      form.email,
      phone:      form.phone || null,
      rut:        form.rut   || null,
      role_label: form.role_label,
      password:   form.password,   // used by admin panel to create auth user
      status:     'pending',
    }])

    if (dbErr) {
      setError('Error al enviar la solicitud. Intenta nuevamente.')
    } else {
      setStep('success')
    }
    setSaving(false)
  }

  /* ── SUCCESS SCREEN ── */
  if (step === 'success') return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: 'center', maxWidth: 420 }}>
        <img
          src="/logo.png" alt="Speech Psychology"
          style={{ width: 80, height: 80, objectFit: 'contain', display: 'block', margin: '0 auto 16px', filter: 'drop-shadow(0 4px 20px rgba(59,130,246,0.4))' }}
        />

        {/* Countdown icon */}
        <div style={{ fontSize: 52, marginBottom: 12 }}>⏳</div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 10 }}>
          ¡Solicitud recibida!
        </div>

        {/* Main message */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(29,78,216,0.2), rgba(8,145,178,0.15))',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 'var(--r-md)',
          padding: '20px 22px',
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🕐</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            En 5 minutos vuelve a ingresar
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
            La administración revisará tu solicitud.<br />
            Una vez aprobada podrás entrar directamente con tu correo y contraseña.
          </div>
        </div>

        {/* Summary */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 22, textAlign: 'left' }}>
          {[
            ['👤', 'Nombre',  form.full_name],
            ['📧', 'Correo',  form.email],
            ['💼', 'Cargo',   form.role_label],
            form.phone ? ['📱', 'Teléfono', form.phone] : null,
          ].filter(Boolean).map(([icon, label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: 70 }}>{label}</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          ))}
        </div>

        <Link
          to="/login"
          style={{
            display: 'block',
            width: '100%',
            padding: '13px',
            background: 'linear-gradient(135deg, var(--navy-500), var(--navy-700))',
            borderRadius: 'var(--r)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(29,78,216,0.4)',
            marginBottom: 14,
          }}
        >
          → Ir a iniciar sesión
        </Link>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          Si en 10 minutos no puedes ingresar, contacta a tu administrador.
        </p>
      </div>
    </div>
  )

  /* ── FORM ── */
  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ width: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img
            src="/logo.png" alt="Speech Psychology"
            style={{ width: 68, height: 68, objectFit: 'contain', display: 'block', margin: '0 auto 10px', filter: 'drop-shadow(0 4px 20px rgba(59,130,246,0.35))' }}
          />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
            Speech Psychology & CardioHome
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Crear cuenta de acceso
          </div>
        </div>

        {/* Info banner */}
        <div style={{ background: 'rgba(29,78,216,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--r)', padding: '11px 14px', marginBottom: 18, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          ℹ️ Completa el formulario. Una vez aprobado por la administración podrás ingresar al sistema.
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 14 }}>⚠ {error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="auth-label">Nombre completo *</label>
              <input className="auth-input" required placeholder="María González"
                value={form.full_name} onChange={e => field('full_name', e.target.value)} />
            </div>
            <div>
              <label className="auth-label">RUT</label>
              <input className="auth-input" placeholder="12.345.678-9"
                value={form.rut} onChange={e => field('rut', e.target.value)} />
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="auth-label">Correo electrónico *</label>
              <input className="auth-input" type="email" required placeholder="nombre@ejemplo.cl"
                value={form.email} onChange={e => field('email', e.target.value)} />
            </div>
            <div>
              <label className="auth-label">Teléfono</label>
              <input className="auth-input" placeholder="+56 9 XXXX XXXX"
                value={form.phone} onChange={e => field('phone', e.target.value)} />
            </div>
          </div>

          {/* Cargo */}
          <label className="auth-label">Cargo *</label>
          <select className="auth-input" required value={form.role_label}
            onChange={e => field('role_label', e.target.value)} style={{ cursor: 'pointer', marginBottom: 14 }}>
            <option value="">Seleccionar cargo...</option>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>

          {/* Password */}
          <label className="auth-label">Contraseña *</label>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <input
              className="auth-input"
              type={showPwd ? 'text' : 'password'}
              required
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={e => field('password', e.target.value)}
              style={{ marginBottom: 0, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)' }}
            >
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>

          {/* Strength bar */}
          {form.password && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                ))}
              </div>
              {strength.label && (
                <div style={{ fontSize: 11, color: strength.color, textAlign: 'right' }}>{strength.label}</div>
              )}
            </div>
          )}

          {/* Confirm password */}
          <label className="auth-label">Repetir contraseña *</label>
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <input
              className="auth-input"
              type={showPwd2 ? 'text' : 'password'}
              required
              placeholder="Repite tu contraseña"
              value={form.password2}
              onChange={e => field('password2', e.target.value)}
              style={{ marginBottom: 0, paddingRight: 44, borderColor: form.password2 && form.password !== form.password2 ? '#dc2626' : undefined }}
            />
            <button
              type="button"
              onClick={() => setShowPwd2(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)' }}
            >
              {showPwd2 ? '🙈' : '👁'}
            </button>
          </div>

          <button className="auth-btn" type="submit" disabled={saving}>
            {saving ? 'Enviando...' : '✓ Solicitar acceso'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
            ← Ya tengo cuenta, iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
