const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  image: {
    type: Buffer,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Dish', dishSchema);