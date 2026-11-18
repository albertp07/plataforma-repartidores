const express = require('express');
const router = express.Router();
const { mapaCalorHandler } = require('../controllers/mapaController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/calor', verificarToken, mapaCalorHandler);

module.exports = router;
