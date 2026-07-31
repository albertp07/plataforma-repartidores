const express = require('express');
const router = express.Router();
const {
  crearRepartidor,
  listarRepartidores,
  obtenerMiPerfilRepartidor,
  actualizarMiPerfil,
} = require('../controllers/repartidorController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.post('/', verificarToken, crearRepartidor);
router.get('/', verificarToken, soloAdmin, listarRepartidores);
router.get('/mi-perfil', verificarToken, obtenerMiPerfilRepartidor);
router.put('/mi-perfil', verificarToken, actualizarMiPerfil);

module.exports = router;
