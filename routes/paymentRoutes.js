const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post('/success', orderController.paymentSuccess);
router.post('/fail', orderController.paymentFail);
router.post('/cancel', orderController.paymentCancel);

router.post('/ipn', (req, res) => {
  res.status(200).send('OK');
});

module.exports = router;