const formatoPeso = (valor) => Math.round(valor).toLocaleString('es-CL');

// Descripción estándar de un gasto de combustible (la usan el formulario y la importación por fotos)
export function descripcionCombustible({ producto, litros, precioLitro, kilometraje, descuento }) {
  let descripcion = 'Bencina / Combustible';
  if (producto) descripcion += ` · ${producto === 'DIESEL' ? 'Diésel' : producto}`;
  if (litros) descripcion += ` · ${litros} L`;
  if (precioLitro) descripcion += ` · $${formatoPeso(Number(precioLitro))}/L`;
  if (kilometraje) descripcion += ` · ${kilometraje} km`;
  if (descuento > 0) descripcion += ` · Ahorro $${formatoPeso(descuento)}`;
  return descripcion;
}
