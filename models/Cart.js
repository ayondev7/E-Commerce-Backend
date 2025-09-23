import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  title: {
    type: String,
    trim: true,
  },
  productIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }
  ]
}, {
  timestamps: true
});

export default mongoose.model('Cart', cartSchema);
