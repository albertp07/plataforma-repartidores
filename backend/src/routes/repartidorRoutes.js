const express = require('express');
const router = express.Router();
const {
  crearRepartidor,
  listarRepartidores,
  obtenerMiPerfilRepartidor,
  actualizarMiMeta,
} = require('../controllers/repartidorController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.post('/', verificarToken, crearRepartidor);
router.get('/', verificarToken, soloAdmin, listarRepartidores);
router.get('/mi-perfil', verificarToken, obtenerMiPerfilRepartidor);
router.patch('/mi-meta', verificarToken, actualizarMiMeta);

module.exports = router;
