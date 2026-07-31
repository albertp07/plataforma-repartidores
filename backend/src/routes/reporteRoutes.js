const express = require('express');
const router = express.Router();
const {
  resumenGeneral,
  balancePorRepartidor,
  movimientosPorFecha,
} = require('../controllers/reporteController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.get('/resumen', verificarToken, soloAdmin, resumenGeneral);
router.get('/por-repartidor', verificarToken, soloAdmin, balancePorRepartidor);
router.get('/por-fecha', verificarToken, soloAdmin, movimientosPorFecha);

module.exports = router;