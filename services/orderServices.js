import Order from '../models/Order.js';
import ShippingInfo from '../models/ShippingInfo.js';
import Product from '../models/Product.js';
import RecentActivity from '../models/RecentActivity.js';
import SellerNotification from '../models/SellerNotification.js';
import { customAlphabet } from 'nanoid';
import SSLCommerzPayment from 'sslcommerz-lts';
import mongoose from 'mongoose';

const orderIdNanoid = customAlphabet('0123456789', 5);
const txnIdNanoid = customAlphabet('0123456789', 7);

const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.SSLCOMMERZ_IS_LIVE === 'true';

export async function generateUniqueOrderId(session) {
  let orderId, orderExists = true;
  while (orderExists) {
    orderId = `ORD-${orderIdNanoid()}`;
    orderExists = await Order.exists({ orderId }).session(session);
  }
  return orderId;
}

export async function generateUniqueTransactionId(session) {
  let transactionId, txnExists = true;
  while (txnExists) {
    transactionId = `TXN-${txnIdNanoid()}`;
    txnExists = await Order.exists({ transactionId }).session(session);
  }
  return transactionId;
}

export async function createShippingInfo(customerId, shippingData, session) {
  const { fullName, phoneNumber, email, addressId, optionalAddressId } = shippingData;

  const shippingInfo = new ShippingInfo({
    customerId,
    fullName,
    phoneNumber,
    email,
    addressId,
    optionalAddressId,
  });

  return await shippingInfo.save({ session });
}

export async function createOrder(orderData, session) {
  const orderId = await generateUniqueOrderId(session);
  const transactionId = await generateUniqueTransactionId(session);

  const order = new Order({
    ...orderData,
    orderId,
    transactionId,
    paymentStatus: 'pending',
    orderStatus: 'pending',
  });

  return await order.save({ session });
}

export async function createOrderActivity(customerId, orderId, orderIdString, session) {
  const activity = new RecentActivity({
    customerId,
    orderId,
    activityType: 'order added',
    activityStatus: `Your order #${orderIdString} has been placed`,
  });

  await activity.save({ session });
}

export async function createSellerNotificationForOrder(productId, orderId, session) {
  const product = await Product.findById(productId).session(session);
  if (product && product.sellerId) {
    const sellerNotification = new SellerNotification({
      notificationType: 'order placed',
      orderId,
      sellerId: product.sellerId,
      description: `An order has been placed for '${product.title}'`,
      timestamp: new Date(),
    });

    await sellerNotification.save({ session });
  }
}

export async function createSellerNotificationForPayment(productId, orderId, orderIdString, session) {
  const product = await Product.findById(productId).session(session);
  if (product && product.sellerId) {
    const sellerNotification = new SellerNotification({
      notificationType: 'Payment Received',
      orderId,
      sellerId: product.sellerId,
      description: `You have received payment for order ID #${orderIdString}`,
      timestamp: new Date(),
    });
    await sellerNotification.save({ session });
  }
}

export async function updateOrdersPaymentStatus(orderIds, status, session) {
  await Order.updateMany(
    { _id: { $in: orderIds } },
    { paymentStatus: status },
    { session }
  );
}

export async function initializePaymentGateway(paymentData) {
  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  return await sslcz.init(paymentData);
}

export function buildPaymentData(checkoutPayload, tempOrderId, shippingData, addressData) {
  return {
    total_amount: checkoutPayload.total,
    currency: 'BDT',
    tran_id: `temp_${tempOrderId}`,
    success_url: `${process.env.BACKEND_URL}/api/payment/success?tran_id=temp_${tempOrderId}`,
    fail_url: `${process.env.BACKEND_URL}/api/payment/fail?tran_id=temp_${tempOrderId}`,
    cancel_url: `${process.env.BACKEND_URL}/api/payment/cancel?tran_id=temp_${tempOrderId}`,
    ipn_url: `${process.env.BACKEND_URL}/api/payment/ipn`,
    shipping_method: 'Courier',
    product_name: `Order for ${checkoutPayload.products?.length || 0} items`,
    product_category: 'Electronic',
    product_profile: 'general',
    cus_name: shippingData.fullName,
    cus_email: shippingData.email,
    cus_add1: addressData.addressLine,
    cus_add2: addressData.addressLine2 || '',
    cus_city: addressData.city,
    cus_state: addressData.state,
    cus_postcode: addressData.zipCode,
    cus_country: addressData.country,
    cus_phone: shippingData.phoneNumber,
    cus_fax: '',
    ship_name: shippingData.fullName,
    ship_add1: addressData.addressLine,
    ship_add2: addressData.addressLine2 || '',
    ship_city: addressData.city,
    ship_state: addressData.state,
    ship_postcode: addressData.zipCode,
    ship_country: addressData.country,
  };
}

export async function getOrdersByCustomer(customerId) {
  const orders = await Order.find({ customerId })
    .sort({ createdAt: -1 })
    .lean();

  return await Promise.all(
    orders.map(async (order) => {
      let productTitle = 'Unknown Product';
      if (order.productId) {
        const product = await Product.findById(order.productId)
          .select('title')
          .lean();
        if (product) productTitle = product.title;
      }

      return {
        ...order,
        status: order.orderStatus,
        productTitle,
      };
    })
  );
}

export async function getOrdersBySeller(sellerId) {
  const sellerProducts = await Product.find(
    { sellerId },
    '_id'
  ).lean();
  const sellerProductIds = sellerProducts.map((p) => p._id);

  const sellerOrders = await Order.find({
    productId: { $in: sellerProductIds },
  })
    .sort({ createdAt: -1 })
    .populate('customerId', 'firstName lastName')
    .lean();

  return sellerOrders.map((order) => ({
    _id: order._id,
    status: order.orderStatus,
    createdAt: order.createdAt,
    orderId: order.orderId,
    updatedAt: order.updatedAt,
    price: order.price,
    quantity: order.quantity,
    customerName: `${order.customerId?.firstName || ''} ${order.customerId?.lastName || ''}`.trim(),
  }));
}

export async function getOrderById(orderId, sellerId) {
  const order = await Order.findOne({ _id: orderId })
    .populate({
      path: 'productId',
      match: { sellerId },
      select: 'title price salePrice category brand model storage colour ram sku tags negotiable productImages quantity conditions',
    })
    .populate({
      path: 'shippingInfoId',
      populate: [{ path: 'addressId' }, { path: 'optionalAddressId' }],
    });

  if (!order || !order.productId) {
    return null;
  }

  const product = order.productId.toObject();
  const stockStatus = product.quantity === 0 ? 'out of stock' : product.quantity <= 10 ? 'low stock' : 'active';
  const firstImageUrl = product.productImages?.[0] || null;

  return {
    _id: order._id,
    quantity: order.quantity,
    price: order.price,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    orderId: order.orderId,
    product: {
      _id: product._id,
      title: product.title,
      price: product.price,
      salePrice: product.salePrice,
      category: product.category,
      brand: product.brand,
      model: product.model,
      storage: product.storage,
      colour: product.colour,
      condition: product.conditions[0],
      ram: product.ram,
      sku: product.sku,
      negotiable: product.negotiable,
      tags: product.tags,
      quantity: product.quantity,
      stockStatus,
      firstImageUrl,
    },
    shippingInfo: order.shippingInfoId,
  };
}

export async function updateOrderStatus(orderId, orderStatus, customerId, sellerId) {
  const order = await Order.findById(orderId);
  if (!order) return null;

  if (sellerId) {
    const product = await Product.findOne({
      _id: order.productId,
      sellerId,
    });
    if (!product) return { authorized: false };
  } else if (customerId) {
    if (String(order.customerId) !== String(customerId)) {
      return { authorized: false };
    }
  }

  if (orderStatus === 'buy again') {
    const newOrderData = order.toObject();
    delete newOrderData._id;
    newOrderData.orderStatus = 'pending';
    newOrderData.createdAt = new Date();
    newOrderData.updatedAt = new Date();

    const newOrder = await Order.create(newOrderData);
    return { buyAgain: true, newOrder };
  }

  order.orderStatus = orderStatus;
  await order.save();

  await RecentActivity.create({
    customerId: order.customerId,
    orderId: order._id,
    activityType: `order ${orderStatus}`,
    activityStatus: `Your order #${order.orderId} has been ${orderStatus}`,
  });

  if (customerId && !sellerId) {
    const product = await Product.findById(order.productId);
    if (product && product.sellerId) {
      await SellerNotification.create({
        notificationType: `Order ${orderStatus}`,
        orderId: order._id,
        sellerId: product.sellerId,
        description: `Order #${order.orderId} has been ${order.orderStatus} by the customer.`,
        timestamp: new Date(),
      });
    }
  }

  return { success: true, order };
}

export async function getOrderStatusCounts(sellerId) {
  const sellerProducts = await Product.find({ sellerId }, '_id');
  const productIds = sellerProducts.map((p) => p._id);

  if (productIds.length === 0) {
    return {
      pending: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
  }

  const counts = await Order.aggregate([
    { $match: { productId: { $in: productIds } } },
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
  ]);

  const result = {
    pending: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  counts.forEach(({ _id, count }) => {
    result[_id] = count;
  });

  return result;
}

export async function getPaymentsByCustomer(customerId) {
  const orders = await Order.find({ customerId }).lean();

  return await Promise.all(
    orders.map(async (order) => {
      const product = await Product.findById(order.productId).select('title');
      return {
        ...order,
        productTitle: product ? product.title : null,
      };
    })
  );
}
