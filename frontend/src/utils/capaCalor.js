// Capa de mapa de calor para Leaflet, dibujada en un canvas propio (sin plugins externos).
// Cada punto se pinta como una mancha difusa en el canal alfa; donde se acumulan más manchas el alfa
// sube, y al final se reemplaza el color de cada píxel según su intensidad con el gradiente elegido.
import L from 'leaflet';

const GRADIENTE_DEFECTO = { 0.2: '#FFE29A', 0.5: '#F7A600', 0.8: '#E0493D', 1: '#C03328' };

// Tabla de 256 colores para el gradiente (índice = intensidad 0-255)
function crearPaleta(gradiente) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 1;
  lienzo.height = 256;
  const ctx = lienzo.getContext('2d');
  const degradado = ctx.createLinearGradient(0, 0, 0, 256);
  Object.entries(gradiente).forEach(([parada, color]) => degradado.addColorStop(Number(parada), color));
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

// Mancha circular que se desvanece hacia el borde
function crearMancha(radio, desenfoque) {
  const total = radio + desenfoque;
  const lienzo = document.createElement('canvas');
  lienzo.width = total * 2;
  lienzo.height = total * 2;
  const ctx = lienzo.getContext('2d');
  const degradado = ctx.createRadialGradient(total, total, 0, total, total, total);
  degradado.addColorStop(0, 'rgba(0,0,0,1)');
  degradado.addColorStop(radio / total, 'rgba(0,0,0,0.45)');
  degradado.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, total * 2, total * 2);
  return lienzo;
}

const CapaCalor = L.Layer.extend({
  options: {
    radio: 26,
    desenfoque: 22,
    max: 1, // peso que corresponde a la máxima intensidad
    opacidadMinima: 0.3,
    gradiente: GRADIENTE_DEFECTO,
    pane: 'overlayPane',
  },

  // puntos: [[lat, lng, peso], ...]
  initialize(puntos, opciones) {
    L.setOptions(this, opciones);
    this._puntos = puntos;
    this._paleta = crearPaleta(this.options.gradiente);
    this._mancha = crearMancha(this.options.radio, this.options.desenfoque);
  },

  onAdd(mapa) {
    this._lienzo = L.DomUtil.create('canvas', 'capa-calor');
    this._lienzo.style.position = 'absolute';
    this._lienzo.style.pointerEvents = 'none';
    mapa.getPane(this.options.pane).appendChild(this._lienzo);
    mapa.on('moveend zoomend resize', this._dibujar, this);
    this._dibujar();
  },

  onRemove(mapa) {
    mapa.off('moveend zoomend resize', this._dibujar, this);
    L.DomUtil.remove(this._lienzo);
    this._lienzo = null;
  },

  _dibujar() {
    const mapa = this._map;
    const lienzo = this._lienzo;
    if (!mapa || !lienzo) return;

    const { x: ancho, y: alto } = mapa.getSize();
    if (ancho === 0 || alto === 0) return;
    lienzo.width = ancho;
    lienzo.height = alto;
    // El canvas vive dentro del panel que se desplaza con el mapa: se ancla a la esquina visible
    L.DomUtil.setPosition(lienzo, mapa.containerPointToLayerPoint([0, 0]));

    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, ancho, alto);

    const { radio, desenfoque, max, opacidadMinima } = this.options;
    const total = radio + desenfoque;
    for (const [lat, lng, peso] of this._puntos) {
      const p = mapa.latLngToContainerPoint([lat, lng]);
      if (p.x < -total || p.y < -total || p.x > ancho + total || p.y > alto + total) continue;
      ctx.globalAlpha = Math.min(1, Math.max(opacidadMinima, peso / max));
      ctx.drawImage(this._mancha, p.x - total, p.y - total);
    }
    ctx.globalAlpha = 1;

    // Pinta cada píxel con el color que le corresponde según su intensidad (alfa acumulado)
    const imagen = ctx.getImageData(0, 0, ancho, alto);
    const datos = imagen.data;
    for (let i = 3; i < datos.length; i += 4) {
      const alfa = datos[i];
      if (!alfa) continue;
      const k = alfa * 4;
      datos[i - 3] = this._paleta[k];
      datos[i - 2] = this._paleta[k + 1];
      datos[i - 1] = this._paleta[k + 2];
    }
    ctx.putImageData(imagen, 0, 0);
  },
});

export function crearCapaCalor(puntos, opciones) {
  return new CapaCalor(puntos, opciones);
}
