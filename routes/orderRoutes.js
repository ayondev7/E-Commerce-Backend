const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const orderController = require('../controllers/orderController');

router.post('/add-order', auth, orderController.AddOrder);

router.get('/get-all', auth, orderController.getAllOrders);

router.get('/get-seller-orders', auth, orderController.getSellerOrders);

router.get('/get-seller-order/:id', auth, orderController.getOrderById);

router.patch('/update-status/:orderId', auth, orderController.updateOrderStatus);

router.get('/get-order-status-counts', auth, orderController.getOrderStatusCounts);

module.exports = router;