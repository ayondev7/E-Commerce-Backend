const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.post('/add-to-cart', auth, cartController.addToCart);
router.get('/get-all', auth, cartController.getCartItems);
router.delete('/delete-cart-item', auth, cartController.removeFromCart);

module.exports = router;
