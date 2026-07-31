const express = require('express');
const router = express.Router();
const {
  crearTransaccion,
  misTransacciones,
  todasLasTransacciones,
  eliminarTransaccion,
} = require('../controllers/transaccionController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');


router.post('/', verificarToken, crearTransaccion);
router.get('/mis-transacciones', verificarToken, misTransacciones);
router.get('/', verificarToken, soloAdmin, todasLasTransacciones);
router.delete('/:id', verificarToken, eliminarTransaccion);

module.exports = router;