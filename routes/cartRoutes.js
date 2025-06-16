const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.post('/add-to-cart', auth, cartController.addToCart);
// router.post('/create-cart-list', auth, cartController.createCartList);
// router.get('/get-all-lists', auth, cartController.getAllLists);
router.get('/get-all', auth, cartController.getCartItems);
// router.delete('/:id', auth, cartController.removeFromCart);

module.exports = router;
