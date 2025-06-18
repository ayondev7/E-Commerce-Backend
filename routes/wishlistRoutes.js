const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const wishlistController = require('../controllers/wishlistController');

router.post('/add-to-list', auth, wishlistController.addToList);
router.post('/create-list', auth, wishlistController.createList);
router.get('/get-all-lists', auth, wishlistController.getAllLists);
router.get('/get-all', auth, wishlistController.getWishlistItems);
router.delete('/delete-wishlist-item/:id', auth, wishlistController.removeFromWishlist);

module.exports = router;
