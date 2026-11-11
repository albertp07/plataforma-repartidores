// Red: prioriza IPv4 y da más tiempo para conectar (evita ETIMEDOUT con IPv6 mal enrutado)
require('dns').setDefaultResultOrder('ipv4first');
require('net').setDefaultAutoSelectFamilyAttemptTimeout(2000);
const express = require('express');
const cors = require('cors');
const repartidorRoutes = require('./routes/repartidorRoutes');
const transaccionRoutes = require('./routes/transaccionRoutes');
const reporteRoutes = require('./routes/reporteRoutes');
const puntoRetiroRoutes = require('./routes/puntoRetiroRoutes');
const capturaRoutes = require('./routes/capturaRoutes');
const chatRoutes = require('./routes/chatRoutes');
const solicitudCambioRoutes = require('./routes/solicitudCambioRoutes');
require('dotenv').config();

const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: en producción define CORS_ORIGINS con los dominios permitidos, separados por coma
// Ej: CORS_ORIGINS=https://repartidores.aryalspa.com
const origenesPermitidos = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors(
    origenesPermitidos.length
      ? {
          origin: (origin, cb) => {
            // Sin origin = herramientas como curl/healthchecks
            if (!origin || origenesPermitidos.includes(origin)) return cb(null, true);
            return cb(new Error('Origen no permitido por CORS'));
          },
        }
      : undefined // desarrollo local: permite todo
  )
);
app.use(express.json());

app.use('/reportes', reporteRoutes);
app.use('/transacciones', transaccionRoutes);
app.use('/puntos-retiro', puntoRetiroRoutes);
app.use('/capturas', capturaRoutes);
app.use('/chat', chatRoutes);
app.use('/repartidores', repartidorRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/solicitudes-cambio', solicitudCambioRoutes);

// Healthcheck para Render / monitores de uptime
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.json({ mensaje: 'API de Plataforma de Repartidores funcionando 🚀' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});