import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
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
    default: 1
  }
}, {
  timestamps: true
});

// Ensure unique combination of customer and product
cartItemSchema.index({ customerId: 1, productId: 1 }, { unique: true });

export default mongoose.model('CartItem', cartItemSchema);