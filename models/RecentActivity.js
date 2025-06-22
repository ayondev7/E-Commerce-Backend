const mongoose = require('mongoose');

const recentActivitySchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    wishlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wishlist',
      required: false,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
    },
    activityType: {
      type: String,
      required: true,
      trim: true,
    },
    activityStatus: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const RecentActivity = mongoose.model('RecentActivity', recentActivitySchema);

module.exports = RecentActivity;
