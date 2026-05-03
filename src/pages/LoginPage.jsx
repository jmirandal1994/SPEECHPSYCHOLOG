import { useState } from 'react'
import { Navigate } from 'react-router-dom'
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
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🏥</div>
          <div>
            <div className="auth-logo-title">HealthOps</div>
            <div className="auth-logo-sub">Gestión de Servicios de Salud</div>
          </div>
        </div>

        <div className="auth-title">Bienvenido</div>
        <div className="auth-sub">Ingresa con tu cuenta institucional</div>

        {error && <div className="auth-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="auth-label">Correo electrónico</label>
          <input
            className="auth-input"
            type="email"
            placeholder="nombre@healthops.cl"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <label className="auth-label">Contraseña</label>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar al sistema →'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          Speech Psychology · CardioHome · HealthOps © 2025
        </p>
      </div>
    </div>
  )
}
