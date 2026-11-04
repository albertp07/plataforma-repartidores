const express = require('express');
const multer = require('multer');
const router = express.Router();
const { analizarCaptura } = require('../controllers/capturaController');
const { verificarToken } = require('../middlewares/authMiddleware');

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

// La imagen se procesa en memoria y no se guarda en disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    cb(new Error('FORMATO_INVALIDO'));
  },
});

function subirImagen(req, res, next) {
  upload.single('imagen')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La imagen supera los 5 MB' });
    if (err.message === 'FORMATO_INVALIDO') return res.status(415).json({ error: 'Formato no permitido. Usa JPG, PNG o WebP' });
    return res.status(400).json({ error: 'No se pudo recibir la imagen' });
  });
}

router.post('/analizar', verificarToken, subirImagen, analizarCaptura);

module.exports = router;
