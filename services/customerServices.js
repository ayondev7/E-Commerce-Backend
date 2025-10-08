import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import Wishlist from '../models/Wishlist.js';
import RecentActivity from '../models/RecentActivity.js';
import { processAndUploadImage } from '../utils/imageKitUtils.js';
import { hashPassword } from '../utils/authUtils.js';

export async function findCustomerByEmail(email) {
  return await Customer.findOne({ email });
}

export async function findCustomerById(customerId) {
  return await Customer.findById(customerId);
}

export async function createCustomer(customerData, imageFile) {
  const { firstName, lastName, email, password, phone, bio } = customerData;

  let customerImage = undefined;
  if (imageFile) {
    const fileName = `${firstName ? firstName.replace(/\s+/g, '_') : 'customer'}_${Date.now()}.webp`;
    customerImage = await processAndUploadImage(imageFile.buffer, fileName);
  }

  const hashedPassword = await hashPassword(password);

  const customer = new Customer({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    phone,
    lastNotificationSeen: null,
    bio,
    ...(customerImage && { customerImage }),
  });

  await customer.save();
  return customer;
}

export async function updateCustomerProfile(customerId, updates, imageFile) {
  const updateData = { ...updates };

  if (imageFile) {
    const customer = await findCustomerById(customerId);
    const fileName = `${customer?.firstName ? customer.firstName.replace(/\s+/g, '_') : 'customer'}_${Date.now()}.webp`;
    updateData.customerImage = await processAndUploadImage(imageFile.buffer, fileName);
  }

  if (updateData.password) {
    updateData.password = await hashPassword(updateData.password);
  }

  return await Customer.findByIdAndUpdate(
    customerId,
    updateData,
    { new: true }
  ).select('-password');
}

export async function getCustomerStats(customerId) {
  const totalOrders = await Order.countDocuments({ customerId });
  const pendingOrders = await Order.countDocuments({
    customerId,
    orderStatus: 'pending',
  });
  
  const wishlists = await Wishlist.find({ customerId }, 'productIds');
  const totalWishlistItems = wishlists.reduce(
    (total, wl) => total + (wl.productIds?.length || 0),
    0
  );

  return {
    totalOrders,
    pendingOrders,
    totalWishlistItems,
  };
}

export async function getCustomerActivities(customerId) {
  return await RecentActivity.find({ customerId }).sort({ createdAt: -1 });
}

export async function getCustomerNotifications(customerId) {
  const customer = await Customer.findById(customerId).select('lastNotificationSeen');
  const lastSeenId = customer?.lastNotificationSeen;

  const activities = await RecentActivity.find({ customerId }).sort({ createdAt: -1 });

  return activities.map((activity) => ({
    ...activity.toObject(),
    isNew: !lastSeenId || activity._id.toString() > lastSeenId.toString(),
  }));
}

export async function markNotificationsAsSeen(customerId, notificationId) {
  await Customer.findByIdAndUpdate(customerId, {
    lastNotificationSeen: notificationId,
  });
}

export function formatCustomerProfile(customer) {
  const { password, customerImage, firstName, lastName, ...rest } = customer.toObject();
  return {
    ...rest,
    name: `${firstName} ${lastName}`,
    image: customerImage || null,
  };
}

export function formatCustomerProfileInfo(customer) {
  const { customerImage, ...profile } = customer;
  return {
    ...profile,
    customerImage: customerImage || null
  };
}
