const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  vistaPreviaParadas,
  listarParadas,
  reemplazarParadas,
  buscarParadasHandler,
} = require('../controllers/paradaController');
const { verificarToken } = require('../middlewares/authMiddleware');

// El PDF se procesa en memoria y no se guarda
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('FORMATO_INVALIDO'));
  },
});

function subirPdf(req, res, next) {
  upload.single('pdf')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El PDF supera los 5 MB' });
    if (err.message === 'FORMATO_INVALIDO') return res.status(415).json({ error: 'Solo se permiten archivos PDF' });
    return res.status(400).json({ error: 'No se pudo recibir el PDF' });
  });
}

router.post('/transacciones/:id/paradas/vista-previa', verificarToken, subirPdf, vistaPreviaParadas);
router.get('/transacciones/:id/paradas', verificarToken, listarParadas);
router.put('/transacciones/:id/paradas', verificarToken, reemplazarParadas);
router.get('/paradas', verificarToken, buscarParadasHandler);

module.exports = router;
