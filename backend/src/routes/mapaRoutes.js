const express = require('express');
const router = express.Router();
const { mapaCalorHandler, rankingParadasHandler } = require('../controllers/mapaController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/calor', verificarToken, mapaCalorHandler);
router.get('/ranking', verificarToken, rankingParadasHandler);

module.exports = router;
