import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('usuario');
    return guardado ? JSON.parse(guardado) : null;
  });

  function iniciarSesion(usuarioData, token) {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuarioData));
    setUsuario(usuarioData);
  }

  function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  function actualizarUsuario(datosParciales) {
    setUsuario((prev) => {
      if (!prev) return prev;
      const actualizado = { ...prev, ...datosParciales };
      localStorage.setItem('usuario', JSON.stringify(actualizado));
      return actualizado;
    });
  }

  return (
    <AuthContext.Provider value={{ usuario, iniciarSesion, cerrarSesion, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}