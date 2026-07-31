const express = require('express');
const cors = require('cors');
const repartidorRoutes = require('./routes/repartidorRoutes');
const transaccionRoutes = require('./routes/transaccionRoutes');
const reporteRoutes = require('./routes/reporteRoutes');
require('dotenv').config();

const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/reportes', reporteRoutes);
app.use('/transacciones', transaccionRoutes);
app.use('/repartidores', repartidorRoutes);
app.use('/usuarios', usuarioRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: 'API de Plataforma de Repartidores funcionando 🚀' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});