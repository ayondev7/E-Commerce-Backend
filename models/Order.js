const mongoose = require('mongoose');
const { customAlphabet } = require('nanoid');
const orderIdNanoid = customAlphabet('0123456789', 5);
const txnIdNanoid = customAlphabet('0123456789', 7);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingInfoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingInfo',
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'paid', 'failed'],
    },
    orderStatus: {
      type: String,
      required: true,
      default: 'pending', 
      enum: ['pending', 'shipped', 'delivered', 'cancelled'],
    },
    paymentMethod: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    if (!this.orderId) {
      let newOrderId;
      let orderExists = true;

      while (orderExists) {
        newOrderId = `ORD-${orderIdNanoid()}`;
        orderExists = await this.constructor.exists({ orderId: newOrderId });
      }

      this.orderId = newOrderId;
    }

    if (!this.transactionId) {
      let newTxnId;
      let txnExists = true;

      while (txnExists) {
        newTxnId = `TXN-${txnIdNanoid()}`;
        txnExists = await this.constructor.exists({ transactionId: newTxnId });
      }

      this.transactionId = newTxnId;
    }
  }

  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
