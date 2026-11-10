// Reemplaza el globo nativo del navegador ("Completa este campo") por un
// mensaje en línea con el estilo de la app. Se activa una sola vez en main.jsx
// y funciona para todos los <form> con atributos required/min/max, sin tocar
// cada componente. El mensaje se pinta con CSS (data-error) para no insertar
// nodos DOM dentro del árbol que maneja React.

function mensajePara(el) {
  const v = el.validity;
  if (v.valueMissing) return el.type === 'checkbox' ? 'Debes aceptar para continuar' : 'Completa este campo';
  if (v.rangeUnderflow) return `El valor mínimo es ${el.min}`;
  if (v.rangeOverflow) return `El valor máximo es ${el.max}`;
  if (v.typeMismatch) return el.type === 'email' ? 'Ingresa un correo válido' : 'Formato no válido';
  if (v.patternMismatch) return el.title || 'Formato no válido';
  if (v.tooShort) return `Mínimo ${el.minLength} caracteres`;
  if (v.stepMismatch || v.badInput) return 'Ingresa un número válido';
  return 'Revisa este campo';
}

function contenedor(el) {
  return el.closest('.field') || el.parentElement;
}

function limpiar(el) {
  const c = contenedor(el);
  if (c) c.removeAttribute('data-error');
  el.removeAttribute('aria-invalid');
}

export function activarValidacionInline() {
  // 'invalid' no burbujea: se escucha en fase de captura.
  document.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      // Cancelar el evento evita el globo nativo, pero el submit sigue bloqueado.
      e.preventDefault();

      const c = contenedor(el);
      if (c) c.setAttribute('data-error', mensajePara(el));
      el.setAttribute('aria-invalid', 'true');

      // Al cancelar 'invalid' el navegador ya no enfoca el primer campo: se hace a mano.
      const form = el.form;
      if (form) {
        const primero = form.querySelector(':invalid');
        if (primero === el) {
          el.focus({ preventScroll: true });
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    },
    true,
  );

  const alCorregir = (e) => {
    const el = e.target;
    if (el.getAttribute && el.getAttribute('aria-invalid') && el.checkValidity()) limpiar(el);
  };
  document.addEventListener('input', alCorregir, true);
  document.addEventListener('change', alCorregir, true);
}
