const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
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


router.post('/register', upload.single('customerImage'), customerController.createCustomer);


router.post('/login', customerController.loginCustomer);

router.get('/get-recent-activity', auth, customerController.getActivitiesByCustomer);

router.get('/get-all-customers', auth, customerController.getAllCustomers);

router.get('/get-overview-stats', auth, customerController.getCustomerStats);

router.get('/get-profile', auth, customerController.getCustomerProfile);

router.get('/profile', auth, customerController.getCustomerProfileInfo);


router.patch('/update', auth, upload.single('customerImage'), customerController.updateCustomer);

module.exports = router;