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


router.get('/get-all-customers', auth("customer"), customerController.getAllCustomers);


router.get('/profile', auth("customer"), customerController.getCustomerProfile);


router.patch('/update', auth("customer"), upload.single('customerImage'), customerController.updateCustomer);


// router.delete('/delete', auth, customerController.deleteCustomer);

module.exports = router;