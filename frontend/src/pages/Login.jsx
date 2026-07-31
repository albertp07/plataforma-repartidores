import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const fecha = new Date()
    .toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
    .toUpperCase();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const data = await login(email, password);
      iniciarSesion(data.usuario, data.token);
      navigate(data.usuario.rol === 'ADMIN' ? '/dashboard' : '/panel');
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <span className="login-eyebrow">TURNO · {fecha}</span>
        <h1 className="login-title">Inicia tu ruta</h1>
        <p className="login-subtitle">
          Ingresa con tu cuenta para registrar tus movimientos del día.
        </p>

        <div className="login-route" aria-hidden="true">
          <span className="login-route-line" />
          <span className="login-route-pin" />
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span className="login-label">Correo electrónico</span>
            <span className="login-input-wrap">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 6 10-6" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@repartidores.com"
                autoComplete="email"
                required
              />
            </span>
          </label>

          <label className="login-field">
            <span className="login-label">Contraseña</span>
            <span className="login-input-wrap">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </span>
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-button" disabled={cargando}>
            {cargando ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>

        <p className="login-footer">Plataforma de Gestión Financiera para Repartidores</p>
      </div>
    </div>
  );
}

export default Login;