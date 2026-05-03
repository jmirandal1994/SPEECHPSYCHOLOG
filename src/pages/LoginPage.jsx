import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
    setLoading(false)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/logo.png"
            alt="Speech Psychology"
            style={{
              width: 110,
              height: 110,
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto 14px',
              filter: 'drop-shadow(0 4px 24px rgba(59,130,246,0.35))',
            }}
          />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Speech Psychology
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            & CardioHome · Gestión de Salud
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 24 }} />

        <div className="auth-title" style={{ fontSize: 20 }}>Bienvenido</div>
        <div className="auth-sub">Ingresa con tu cuenta institucional</div>

        {error && <div className="auth-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="auth-label">Correo electrónico</label>
          <input
            className="auth-input"
            type="email"
            placeholder="nombre@speechpsychology.cl"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label className="auth-label">Contraseña</label>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Ingresar al sistema →'}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" style={{ color: 'rgba(99,130,246,0.9)', fontWeight: 600, textDecoration: 'none' }}>
            Solicitar acceso →
          </Link>
        </p>

        <p style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.15)', lineHeight: 1.6 }}>
          Speech Psychology & CardioHome<br />
          Alianza Estratégica en Salud © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
