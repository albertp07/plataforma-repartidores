import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, registrar } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function Login() {
  const [vista, setVista] = useState('login'); // 'login' | 'registro'

  useEffect(() => {
    document.title = 'Aryal - Iniciar Sesión';
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regVehiculo, setRegVehiculo] = useState('');
  const [regError, setRegError] = useState('');
  const [regExito, setRegExito] = useState('');
  const [regCargando, setRegCargando] = useState(false);

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

  async function handleRegistro(e) {
    e.preventDefault();
    setRegError('');
    setRegExito('');
    setRegCargando(true);

    try {
      await registrar({
        nombre: regNombre,
        email: regEmail,
        password: regPassword,
        telefono: regTelefono || undefined,
        vehiculo: regVehiculo || undefined,
      });
      setRegExito('¡Solicitud enviada! Tu cuenta está en revisión. El administrador te dará el alta para poder ingresar.');
      setRegNombre('');
      setRegEmail('');
      setRegPassword('');
      setRegTelefono('');
      setRegVehiculo('');
    } catch (err) {
      setRegError(err.response?.data?.error || 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setRegCargando(false);
    }
  }

  function irARegistro() {
    setVista('registro');
    setError('');
    setRegError('');
    setRegExito('');
  }

  function irALogin() {
    setVista('login');
    setRegError('');
    setRegExito('');
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

        {vista === 'login' ? (
          <>
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

            <p className="login-toggle">
              ¿No tienes cuenta?{' '}
              <button type="button" className="login-link" onClick={irARegistro}>
                Solicitar acceso
              </button>
            </p>
          </>
        ) : (
          <>
            <h1 className="login-title">Solicitar acceso</h1>
            <p className="login-subtitle">
              Completa tus datos. Un administrador revisará tu solicitud antes de habilitar tu cuenta.
            </p>

            <div className="login-route" aria-hidden="true">
              <span className="login-route-line" />
              <span className="login-route-pin" />
            </div>

            {regExito ? (
              <p className="login-success" role="status">
                {regExito}
              </p>
            ) : (
              <form className="login-form" onSubmit={handleRegistro} noValidate>
                <label className="login-field">
                  <span className="login-label">Nombre</span>
                  <span className="login-input-wrap">
                    <input
                      type="text"
                      value={regNombre}
                      onChange={(e) => setRegNombre(e.target.value)}
                      placeholder="Nombre completo"
                      autoComplete="name"
                      required
                      className="login-input-plain"
                    />
                  </span>
                </label>

                <label className="login-field">
                  <span className="login-label">Correo electrónico</span>
                  <span className="login-input-wrap">
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="tucorreo@repartidores.com"
                      autoComplete="email"
                      required
                      className="login-input-plain"
                    />
                  </span>
                </label>

                <label className="login-field">
                  <span className="login-label">Contraseña</span>
                  <span className="login-input-wrap">
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="login-input-plain"
                    />
                  </span>
                </label>

                <label className="login-field">
                  <span className="login-label">Teléfono (opcional)</span>
                  <span className="login-input-wrap">
                    <input
                      type="tel"
                      value={regTelefono}
                      onChange={(e) => setRegTelefono(e.target.value)}
                      placeholder="+56 9 1234 5678"
                      autoComplete="tel"
                      className="login-input-plain"
                    />
                  </span>
                </label>

                <label className="login-field">
                  <span className="login-label">Vehículo (opcional)</span>
                  <span className="login-input-wrap">
                    <input
                      type="text"
                      value={regVehiculo}
                      onChange={(e) => setRegVehiculo(e.target.value)}
                      placeholder="Moto, auto, bicicleta..."
                      className="login-input-plain"
                    />
                  </span>
                </label>

                {regError && (
                  <p className="login-error" role="alert">
                    {regError}
                  </p>
                )}

                <button type="submit" className="login-button" disabled={regCargando}>
                  {regCargando ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </form>
            )}

            <p className="login-toggle">
              ¿Ya tienes cuenta?{' '}
              <button type="button" className="login-link" onClick={irALogin}>
                Iniciar sesión
              </button>
            </p>
          </>
        )}

        <p className="login-footer">Plataforma de Gestión Financiera para Repartidores</p>
      </div>
    </div>
  );
}

export default Login;
