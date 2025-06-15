const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.post('/add', auth("customer"), cartController.addToCart);
router.get('/get-all', auth("customer"), cartController.getCartItems);
router.delete('/:id', auth("customer"), cartController.removeFromCart);

module.exports = router;
