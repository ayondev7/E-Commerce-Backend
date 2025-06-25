const Address = require("../models/Address");
const ShippingInfo = require("../models/ShippingInfo");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const RecentActivity = require("../models/RecentActivity");
const { customAlphabet } = require("nanoid");
const orderIdNanoid = customAlphabet("0123456789", 5);
const txnIdNanoid = customAlphabet("0123456789", 7);
const SSLCommerzPayment = require("sslcommerz-lts");
const SellerNotification = require("../models/SellerNotification");
const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.SSLCOMMERZ_IS_LIVE === "true";

const tempOrderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  shippingInfoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  addressIds: {
    primary: mongoose.Schema.Types.ObjectId,
    optional: mongoose.Schema.Types.ObjectId,
  },
  checkoutPayload: mongoose.Schema.Types.Mixed,
  products: [mongoose.Schema.Types.Mixed],
  expiresAt: { type: Date, default: Date.now, expires: 3600 },
});

const TempOrder =
  mongoose.models.TempOrder || mongoose.model("TempOrder", tempOrderSchema);

exports.AddOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      paymentMethod,
      promoCode,
      fullName,
      phoneNumber,
      email,
      addressId,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      name,
      checkoutPayload,
    } = req.body;

    const customerId = req.customer?._id;

    if (!customerId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Customer ID is required" });
    }

    if (
      !checkoutPayload ||
      !checkoutPayload.products ||
      checkoutPayload.products.length === 0
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Products are required in checkout payload",
      });
    }

    let shippingInfoId;
    let primaryAddressId = addressId;
    let optionalAddressId = null;
    let addressForGateway;

    if (!addressId) {
      if (!addressLine1 || !city || !zipCode || !country) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message:
            "Address details are required when addressId is not provided",
        });
      }

      const primaryAddress = new Address({
        customerId,
        name: name || "Unnamed",
        addressLine: addressLine1,
        city,
        zipCode,
        country,
        state: state || "",
        isDefault: false,
      });

      const savedPrimaryAddress = await primaryAddress.save({ session });
      primaryAddressId = savedPrimaryAddress._id;

      addressForGateway = {
        addressLine: savedPrimaryAddress.addressLine,
        city: savedPrimaryAddress.city,
        zipCode: savedPrimaryAddress.zipCode,
        country: savedPrimaryAddress.country,
        state: savedPrimaryAddress.state,
      };

      if (addressLine2 && addressLine2.trim() !== "") {
        const optionalAddress = new Address({
          customerId,
          name: name || "Unnamed",
          addressLine: addressLine2,
          city,
          zipCode,
          country,
          state: state || "",
          isDefault: false,
        });

        const savedOptionalAddress = await optionalAddress.save({ session });
        optionalAddressId = savedOptionalAddress._id;
      }
    } else {
      const foundAddress = await Address.findById(addressId).session(session);
      if (!foundAddress) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ success: false, message: "Address not found" });
      }
      addressForGateway = {
        addressLine: foundAddress.addressLine,
        city: foundAddress.city,
        zipCode: foundAddress.zipCode,
        country: foundAddress.country,
        state: foundAddress.state,
      };
    }

    const shippingInfo = new ShippingInfo({
      customerId,
      fullName,
      phoneNumber,
      email,
      addressId: primaryAddressId,
      optionalAddressId,
    });

    const savedShippingInfo = await shippingInfo.save({ session });
    shippingInfoId = savedShippingInfo._id;

    const createdOrders = [];
    const products = checkoutPayload.products;

    for (const product of products) {
      const { productId, quantity, price } = product;

      if (!productId || !quantity || price === undefined) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Each product must have productId, quantity, and price",
        });
      }

      let orderId,
        orderExists = true;
      while (orderExists) {
        orderId = `ORD-${orderIdNanoid()}`;
        orderExists = await Order.exists({ orderId }).session(session);
      }

      let transactionId,
        txnExists = true;
      while (txnExists) {
        transactionId = `TXN-${txnIdNanoid()}`;
        txnExists = await Order.exists({ transactionId }).session(session);
      }

      const quantityNum = parseInt(quantity);

      const order = new Order({
        customerId,
        productId,
        quantity: quantityNum,
        price,
        paymentMethod,
        shippingInfoId,
        paymentStatus: "pending",
        orderStatus: "pending",
        orderId,
        transactionId,
      });

      const savedOrder = await order.save({ session });
      createdOrders.push(savedOrder);

      const productDoc = await Product.findById(productId).session(session);
      if (productDoc && productDoc.sellerId) {
        const sellerNotification = new SellerNotification({
          notificationType: "order placed",
          orderId: savedOrder._id,
          sellerId: productDoc.sellerId,
          description: `An order has been placed for '${productDoc.title}'`,
          timestamp: new Date(),
        });

        await sellerNotification.save({ session });
      }

      const activity = new RecentActivity({
        customerId,
        orderId: savedOrder._id,
        activityType: "order added",
        activityStatus: `Your order #${savedOrder.orderId} has been placed`,
      });

      await activity.save({ session });
    }

    if (paymentMethod === "cod") {
      const orderedProductIds = products.map((p) => p.productId);
      const carts = await Cart.find({ customerId }).session(session);

      for (const cart of carts) {
        const productIdsArray = Array.isArray(cart.productIds)
          ? cart.productIds.map((id) => id.toString())
          : [cart.productIds.toString()];

        const remaining = productIdsArray.filter(
          (id) => !orderedProductIds.includes(id)
        );

        if (remaining.length === 0) {
          await Cart.deleteOne({ _id: cart._id }).session(session);
        } else {
          cart.productIds = remaining;
          await cart.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        success: true,
        message: "Orders created successfully",
        data: {
          orders: createdOrders,
          shippingInfo: savedShippingInfo,
          addresses: {
            primary: primaryAddressId,
            optional: optionalAddressId,
          },
          orderSummary: {
            totalOrders: createdOrders.length,
            subtotal: checkoutPayload.subtotal,
            shipping: checkoutPayload.shipping || 0,
            tax: checkoutPayload.tax || 0,
            total: checkoutPayload.total,
          },
        },
      });
    } else if (paymentMethod === "gateway") {
      const tempOrderData = {
        customerId,
        orders: createdOrders.map((order) => order._id),
        shippingInfoId,
        addressIds: {
          primary: primaryAddressId,
          optional: optionalAddressId,
        },
        checkoutPayload,
        products: products,
      };

      const tempOrder = new TempOrder(tempOrderData);
      const savedTempOrder = await tempOrder.save({ session });

      const data = {
        total_amount: checkoutPayload.total,
        currency: "BDT",
        tran_id: `temp_${savedTempOrder._id}`,
        success_url: `${process.env.BACKEND_URL}/api/payment/success?tran_id=temp_${savedTempOrder._id}`,
        fail_url: `${process.env.BACKEND_URL}/api/payment/fail?tran_id=temp_${savedTempOrder._id}`,
        cancel_url: `${process.env.BACKEND_URL}/api/payment/cancel?tran_id=temp_${savedTempOrder._id}`,
        ipn_url: `${process.env.BACKEND_URL}/api/payment/ipn`,
        shipping_method: "Courier",
        product_name: `Order for ${createdOrders.length} items`,
        product_category: "Electronic",
        product_profile: "general",
        cus_name: fullName,
        cus_email: email,
        cus_add1: addressForGateway.addressLine,
        cus_add2: addressLine2 || "",
        cus_city: addressForGateway.city,
        cus_state: addressForGateway.state,
        cus_postcode: addressForGateway.zipCode,
        cus_country: addressForGateway.country,
        cus_phone: phoneNumber,
        cus_fax: "",
        ship_name: fullName,
        ship_add1: addressForGateway.addressLine,
        ship_add2: addressLine2 || "",
        ship_city: addressForGateway.city,
        ship_state: addressForGateway.state,
        ship_postcode: addressForGateway.zipCode,
        ship_country: addressForGateway.country,
      };

      await session.commitTransaction();
      session.endSession();

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      const apiResponse = await sslcz.init(data);

      if (apiResponse.GatewayPageURL) {
        return res.status(200).json({
          success: true,
          message: "Payment session created",
          data: {
            paymentUrl: apiResponse.GatewayPageURL,
            sessionkey: apiResponse.sessionkey,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to create payment session",
          error: apiResponse,
        });
      }
    }
  } catch (error) {
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortErr) {}
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

exports.paymentSuccess = async (req, res) => {
  const { tran_id } = req.query;
  try {
    if (!tran_id || !tran_id.startsWith("temp_")) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/fail?tran_id=invalid`
      );
    }

    const tempOrderId = tran_id.replace("temp_", "");
    const tempOrder = await TempOrder.findById(tempOrderId)
      .populate("orders")
      .populate("shippingInfoId");

    if (!tempOrder) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/fail?tran_id=${tran_id}`
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Order.updateMany(
        { _id: { $in: tempOrder.orders } },
        { paymentStatus: "paid" },
        { session }
      );

      const populatedOrders = await Order.find({
        _id: { $in: tempOrder.orders },
      }).session(session);

      for (const order of populatedOrders) {
        const product = await Product.findById(order.productId).session(
          session
        );
        if (product && product.sellerId) {
          const sellerNotification = new SellerNotification({
            notificationType: "Payment Received",
            orderId: order._id,
            sellerId: product.sellerId,
            description: `You have received payment for order ID #${order.orderId}`,
            timestamp: new Date(),
          });
          await sellerNotification.save({ session });
        }
      }

      const orderedProductIds = tempOrder.products.map((p) => p.productId);
      const carts = await Cart.find({
        customerId: tempOrder.customerId,
      }).session(session);

      for (const cart of carts) {
        const productIdsArray = Array.isArray(cart.productIds)
          ? cart.productIds.map((id) => id.toString())
          : [cart.productIds.toString()];

        const remaining = productIdsArray.filter(
          (id) => !orderedProductIds.includes(id)
        );

        if (remaining.length === 0) {
          await Cart.deleteOne({ _id: cart._id }).session(session);
        } else {
          cart.productIds = remaining;
          await cart.save({ session });
        }
      }

      await TempOrder.findByIdAndDelete(tempOrderId).session(session);
      await session.commitTransaction();
      session.endSession();

      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/success?tran_id=${tran_id}`
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/fail?tran_id=${tran_id}`
      );
    }
  } catch (error) {
    console.error("Payment success error:", error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/payment/fail?tran_id=${tran_id}`
    );
  }
};

exports.paymentFail = async (req, res) => {
  const { tran_id } = req.query;

  try {
    if (tran_id && tran_id.startsWith("temp_")) {
      const tempOrderId = tran_id.replace("temp_", "");
      const TempOrder = mongoose.model("TempOrder");
      const tempOrder = await TempOrder.findById(tempOrderId).populate(
        "orders"
      );

      if (tempOrder) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          await Order.deleteMany(
            { _id: { $in: tempOrder.orders } },
            { session }
          );
          await ShippingInfo.findByIdAndDelete(tempOrder.shippingInfoId, {
            session,
          });

          if (
            tempOrder.addressIds.primary &&
            !tempOrder.addressIds.primary.toString().startsWith("existing_")
          ) {
            await Address.findByIdAndDelete(tempOrder.addressIds.primary, {
              session,
            });
          }
          if (tempOrder.addressIds.optional) {
            await Address.findByIdAndDelete(tempOrder.addressIds.optional, {
              session,
            });
          }

          await TempOrder.findByIdAndDelete(tempOrderId, { session });

          await session.commitTransaction();
          session.endSession();
        } catch (error) {
          await session.abortTransaction();
          session.endSession();
        }
      }
    }

    return res.redirect(
      `${process.env.FRONTEND_URL}/payment/fail?tran_id=${tran_id || "unknown"}`
    );
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process payment failure",
      error: error.message,
    });
  }
};

exports.paymentCancel = async (req, res) => {
  return exports.paymentFail(req, res);
};

exports.getAllOrders = async (req, res) => {
  try {
    const { customer } = req;

    if (!customer || !customer._id) {
      return res.status(400).json({
        success: false,
        message: "Customer information not found",
      });
    }

    const orders = await Order.find({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .lean();

    const transformedOrders = await Promise.all(
      orders.map(async (order, index) => {
        let productTitle = "Unknown Product";
        if (order.productId) {
          const product = await Product.findById(order.productId)
            .select("title")
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

    res.status(200).json({
      success: true,
      count: transformedOrders.length,
      orders: transformedOrders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching orders",
      error: error.message,
    });
  }
};

exports.getSellerOrders = async (req, res) => {
  try {
    const { seller } = req;

    if (!seller || !seller._id) {
      return res.status(400).json({
        success: false,
        message: "Seller information not found",
      });
    }

    const sellerProducts = await Product.find(
      { sellerId: seller._id },
      "_id"
    ).lean();
    const sellerProductIds = sellerProducts.map((p) => p._id);

    const sellerOrders = await Order.find({
      productId: { $in: sellerProductIds },
    })
      .sort({ createdAt: -1 })
      .populate("customerId", "firstName lastName")
      .lean();

    const transformedOrders = sellerOrders.map((order, index) => {
      return {
        _id: order._id,
        status: order.orderStatus,
        createdAt: order.createdAt,
        orderId: order.orderId,
        updatedAt: order.updatedAt,
        price: order.price,
        quantity: order.quantity,
        customerName: `${order.customerId?.firstName || ""} ${
          order.customerId?.lastName || ""
        }`.trim(),
      };
    });

    res.status(200).json({
      success: true,
      count: transformedOrders.length,
      data: transformedOrders,
    });
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching seller orders",
      error: error.message,
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.seller._id;

    const order = await Order.findOne({ _id: id })
      .populate({
        path: "productId",
        match: { sellerId },
        select:
          "title price salePrice category brand model storage colour ram sku tags negotiable productImages quantity conditions",
      })
      .populate({
        path: "shippingInfoId",
        populate: [{ path: "addressId" }, { path: "optionalAddressId" }],
      });

    if (!order || !order.productId) {
      return res
        .status(404)
        .json({ message: "Order not found or unauthorized" });
    }

    const product = order.productId.toObject();

    const stockStatus =
      product.quantity === 0
        ? "out of stock"
        : product.quantity <= 10
        ? "low stock"
        : "active";

    const firstImageBase64 = product.productImages?.[0]
      ? product.productImages[0].toString("base64")
      : null;

    const response = {
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
        firstImageBase64,
      },

      shippingInfo: order.shippingInfoId,
    };

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const sellerId = req.seller?._id;
    const customerId = req.customer?._id;

    if (!orderId || !orderStatus) {
      return res
        .status(400)
        .json({ message: "Order ID and orderStatus are required." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (sellerId) {
      const product = await Product.findOne({
        _id: order.productId,
        sellerId: sellerId,
      });

      if (!product) {
        return res
          .status(403)
          .json({ message: "You are not authorized to update this order." });
      }
    } else if (customerId) {
      if (String(order.customerId) !== String(customerId)) {
        return res
          .status(403)
          .json({ message: "You are not authorized to update this order." });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized request." });
    }

    if (orderStatus === "buy again") {
      const newOrderData = order.toObject();
      delete newOrderData._id;
      newOrderData.orderStatus = "pending";
      newOrderData.createdAt = new Date();
      newOrderData.updatedAt = new Date();

      const newOrder = await Order.create(newOrderData);

      return res.status(201).json({
        message: "New order created successfully for Buy Again.",
        newOrder,
      });
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

    res
      .status(200)
      .json({ message: "Order status updated successfully.", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.getOrderStatusCounts = async (req, res) => {
  try {
    const { seller } = req;
    const { _id: sellerId } = seller;

    const sellerProducts = await Product.find({ sellerId }, "_id");
    const productIds = sellerProducts.map((p) => p._id);

    if (productIds.length === 0) {
      return res.status(200).json({
        pending: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      });
    }

    const counts = await Order.aggregate([
      {
        $match: {
          productId: { $in: productIds },
        },
      },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
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

    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting order status counts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllPayments = async (req, res) => {
  try {
    const { customer } = req;
    const customerId = customer?._id;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const orders = await Order.find({ customerId }).lean();

    const payments = await Promise.all(
      orders.map(async (order) => {
        const product = await Product.findById(order.productId).select("title");
        return {
          ...order,
          productTitle: product ? product.title : null,
        };
      })
    );

    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
