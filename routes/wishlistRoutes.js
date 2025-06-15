const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const wishlistController = require('../controllers/wishlistController');

router.post('/add', auth, wishlistController.addToWishlist);
router.get('/get-all', auth, wishlistController.getWishlistItems);
router.delete('/:id', auth, wishlistController.removeFromWishlist);

module.exports = router;
