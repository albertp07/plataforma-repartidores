const express = require('express');
const router = express.Router();
const { registrarUsuario, login } = require('../controllers/usuarioController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.post('/', registrarUsuario);
router.post('/login', login);
router.get('/perfil', verificarToken, (req, res) => {
    res.json({ mensaje: 'Acceso concedido', usuario: req.usuario });
  });

module.exports = router;