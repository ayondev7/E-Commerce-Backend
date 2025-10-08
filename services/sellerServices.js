import Seller from '../models/Seller.js';
import SellerNotification from '../models/SellerNotification.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { processAndUploadImage } from '../utils/imageKitUtils.js';
import { hashPassword } from '../utils/authUtils.js';

export async function findSellerByEmail(email) {
  return await Seller.findOne({ email });
}

export async function findSellerById(sellerId) {
  return await Seller.findById(sellerId);
}

export async function createSeller(sellerData, imageFile) {
  const { name, email, password, phone } = sellerData;

  let sellerImageUrl = null;
  if (imageFile) {
    const fileName = `${name.replace(/\s+/g, '_')}_${Date.now()}.webp`;
    sellerImageUrl = await processAndUploadImage(imageFile.buffer, fileName);
  }

  const hashedPassword = await hashPassword(password, 10);

  const seller = new Seller({
    name,
    email,
    phone,
    lastNotificationSeen: null,
    password: hashedPassword,
    sellerImage: sellerImageUrl,
  });

  await seller.save();
  return seller;
}

export async function getSellerNotifications(sellerId) {
  const seller = await Seller.findById(sellerId);
  const lastSeenId = seller?.lastNotificationSeen;

  const notifications = await SellerNotification.find({ sellerId }).sort({ createdAt: -1 });

  return notifications.map((notification) => ({
    ...notification.toObject(),
    isNew: lastSeenId ? notification._id > lastSeenId : true,
  }));
}

export async function updateLastNotificationSeen(sellerId, lastSeenNotificationId) {
  await Seller.findByIdAndUpdate(sellerId, {
    lastNotificationSeen: lastSeenNotificationId,
  });
}

export async function getSellerPayments(sellerId) {
  const sellerProducts = await Product.find({ sellerId }).select('_id title').lean();

  const productIdToTitleMap = {};
  const sellerProductIds = sellerProducts.map((product) => {
    productIdToTitleMap[product._id.toString()] = product.title;
    return product._id;
  });

  const orders = await Order.find({
    productId: { $in: sellerProductIds },
  }).lean();

  return orders.map((order) => ({
    ...order,
    productTitle: productIdToTitleMap[order.productId.toString()] || null,
  }));
}

export function formatSellerProfile(seller) {
  const { password, sellerImage, ...rest } = seller.toObject();
  return {
    ...rest,
    image: sellerImage || null,
  };
}

export function formatSellerData(seller) {
  const { password, sellerImage, ...sellerData } = seller.toObject();
  return sellerData;
}
