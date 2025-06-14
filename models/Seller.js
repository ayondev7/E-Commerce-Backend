const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  sellerImage: {
    type: Buffer,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Seller', sellerSchema);