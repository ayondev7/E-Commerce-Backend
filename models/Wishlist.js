import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    unique: true
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

export default mongoose.model('Wishlist', wishlistSchema);
