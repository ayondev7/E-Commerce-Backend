const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const wishlistController = require('../controllers/wishlistController');

router.post('/add', auth("customer"), wishlistController.addToWishlist);
router.get('/get-all', auth("customer"), wishlistController.getWishlistItems);
router.delete('/:id', auth("customer"), wishlistController.removeFromWishlist);

module.exports = router;
