const express = require('express');
const auth = require('../middleware/auth');
const addressController = require('../controllers/addressController');

const router = express.Router();

router.post('/add', auth, addressController.addAddress);
router.get('/all', auth, addressController.getAllAddresses);
router.patch('/:id', auth, addressController.updateAddress);
router.delete('/:id', auth, addressController.deleteAddress);
router.patch('/default/:id', auth, addressController.setDefaultAddress);

module.exports = router;
