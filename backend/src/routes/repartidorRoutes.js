const express = require('express');
const router = express.Router();
const {
  crearRepartidor,
  listarRepartidores,
  obtenerMiPerfilRepartidor,
} = require('../controllers/repartidorController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.post('/', verificarToken, crearRepartidor);
router.get('/', verificarToken, soloAdmin, listarRepartidores);
router.get('/mi-perfil', verificarToken, obtenerMiPerfilRepartidor);

module.exports = router;