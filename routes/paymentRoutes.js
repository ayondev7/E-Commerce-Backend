import express from 'express';
const router = express.Router();
import * as orderController from '../controllers/orderController.js';

router.post('/success', orderController.paymentSuccess);
router.post('/fail', orderController.paymentFail);
router.post('/cancel', orderController.paymentCancel);

router.post('/ipn', (req, res) => {
  res.status(200).send('OK');
});

export default router;