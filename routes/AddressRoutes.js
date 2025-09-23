import express from 'express';
import auth from '../middleware/auth.js';
import * as addressController from '../controllers/addressController.js';

const router = express.Router();

router.post('/add', auth, addressController.addAddress);
router.get('/all', auth, addressController.getAllAddresses);
router.patch('/:id', auth, addressController.updateAddress);
router.delete('/:id', auth, addressController.deleteAddress);
router.patch('/default/:id', auth, addressController.setDefaultAddress);

export default router;
