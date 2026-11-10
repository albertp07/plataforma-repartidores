const express = require('express');
const router = express.Router();
const {
  crearSolicitud,
  listarMisSolicitudes,
  listarSolicitudes,
  resolverSolicitud,
} = require('../controllers/solicitudCambioController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.post('/', verificarToken, crearSolicitud);
router.get('/mias', verificarToken, listarMisSolicitudes);

router.get('/', verificarToken, soloAdmin, listarSolicitudes);
router.patch('/:id', verificarToken, soloAdmin, resolverSolicitud);

module.exports = router;
