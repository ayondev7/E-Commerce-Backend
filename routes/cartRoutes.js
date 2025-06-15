const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.post('/add', auth, cartController.addToCart);
router.get('/get-all', auth, cartController.getCartItems);
router.delete('/:id', auth, cartController.removeFromCart);

module.exports = router;
