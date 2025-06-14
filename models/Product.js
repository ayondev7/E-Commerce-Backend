const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  productImages: [{ type: Buffer }],
  category: { type: String, required: true, trim: true },
  brand: { type: String, trim: true, required: true },
  model: { type: String, trim: true, required: true },
  storage: { type: String, trim: true, required: true },
  colour: { type: String, trim: true, required: true },
  ram: { type: String, trim: true, required: true },

  conditions: [{ type: String, trim: true, required: true }],
  features: [{ type: String, trim: true, required: true }],

  specifications: [
    {
      label: { type: String, trim: true, required: true },
      value: { type: String, trim: true, required: true }
    }
  ],

  price: { type: Number, required: true },
  salePrice: { type: Number },
  quantity: { type: Number, required: true },
  sku: { type: String, unique: true, trim: true },
  negotiable: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
  seoTitle: { type: String, trim: true },
  seoDescription: { type: String, trim: true },

  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  }
}, {
  timestamps: true
});

productSchema.path('productImages').validate(function (value) {
  return value.length <= 4;
}, 'A product can have at most 4 images.');

module.exports = mongoose.model('Product', productSchema);
