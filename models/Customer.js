const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  lastNotificationSeen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecentActivity',
    default: null
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
  bio: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  customerImage: {
    type: Buffer
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);