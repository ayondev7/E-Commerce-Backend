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
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: "Please enter a valid email"
    }
  },
   phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(v);
      },
      message: "Please enter a valid phone number"
    }
  },
  password: {
    type: String,
    required: true
  },
  lastNotificationSeen: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'SellerNotification',
  default: null
},
  sellerImage: {
    type: Buffer,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Seller', sellerSchema);