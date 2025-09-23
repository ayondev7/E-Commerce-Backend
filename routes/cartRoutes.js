import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import * as cartController from '../controllers/cartController.js';

router.post('/add-to-cart', auth, cartController.addToCart);
router.post('/add-product', auth, cartController.addProductDirect);
router.get('/get-all', auth, cartController.getCartItems);
router.delete('/delete-cart-item', auth, cartController.removeFromCart);
router.patch('/update-quantity', auth, cartController.updateCartItemQuantity);

export default router;
