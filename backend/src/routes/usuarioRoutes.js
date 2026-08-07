const express = require('express');
const router = express.Router();
const {
  registrarUsuario,
  login,
  loginConGoogle,
  listarPendientes,
  actualizarEstado,
} = require('../controllers/usuarioController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.post('/', registrarUsuario);
router.post('/login', login);
router.post('/google', loginConGoogle);
router.get('/perfil', verificarToken, (req, res) => {
  res.json({ mensaje: 'Acceso concedido', usuario: req.usuario });
});

router.get('/pendientes', verificarToken, soloAdmin, listarPendientes);
router.patch('/:id/estado', verificarToken, soloAdmin, actualizarEstado);

module.exports = router;
