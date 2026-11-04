const express = require('express');
const router = express.Router();
const { conversar } = require('../controllers/chatController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.post('/', verificarToken, conversar);

module.exports = router;
