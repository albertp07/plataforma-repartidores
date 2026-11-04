const express = require('express');
const router = express.Router();
const {
  listarPuntosRetiro,
  crearPuntoRetiro,
  actualizarPuntoRetiro,
  desactivarPuntoRetiro,
} = require('../controllers/puntoRetiroController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarPuntosRetiro);
router.post('/', verificarToken, crearPuntoRetiro);
router.put('/:id', verificarToken, actualizarPuntoRetiro);
router.delete('/:id', verificarToken, desactivarPuntoRetiro);

module.exports = router;
