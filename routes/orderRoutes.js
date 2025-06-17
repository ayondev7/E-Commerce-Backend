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


// // Update payment status
// router.put('/update-payment/:id', auth, orderController.updatePaymentStatus);

// // Cancel order
// router.put('/cancel/:id', auth, orderController.cancelOrder);

// // Get orders by status
// router.get('/status/:status', auth, orderController.getOrdersByStatus);

// // Get order history with pagination
// router.get('/history', auth, orderController.getOrderHistory);

module.exports = router;