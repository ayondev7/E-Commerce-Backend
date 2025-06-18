const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
});

router.post('/register', upload.single('sellerImage'), sellerController.createSeller);
router.post('/login', sellerController.loginSeller);
router.get('/get-all-sellers', auth, sellerController.getAllSellers);
router.get('/get-profile', auth, sellerController.getSellerProfile);

module.exports = router;