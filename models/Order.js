const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
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
    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingTax: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
