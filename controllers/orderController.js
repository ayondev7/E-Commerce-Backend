const Address = require("../models/Address");
const ShippingInfo = require("../models/ShippingInfo");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
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
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
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

      const order = new Order({
        customerId,
        productId,
        quantity,
        price,
        paymentMethod,
        shippingInfoId,
        paymentStatus: "pending",
        orderStatus: "pending",
      });

      const savedOrder = await order.save({ session });
      createdOrders.push(savedOrder);
    }

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
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error creating order:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
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
        const orderNumber = String(index + 1).padStart(3, "0");

        let productTitle = "Unknown Product";
        if (order.productId) {
          const product = await Product.findById(order.productId).select("title").lean();
          if (product) productTitle = product.title;
        }

        return {
          ...order,
          orderId: `ORD-${orderNumber}`,
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
      const orderNumber = String(index + 1).padStart(3, "0");

      return {
        _id: order._id,
        orderId: `ORD-${orderNumber}`,
        status: order.orderStatus,
        createdAt: order.createdAt,
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
        path: 'productId',
        match: { sellerId },
        select: 'title price salePrice category brand model storage colour ram sku tags negotiable productImages quantity conditions',
      })
      .populate({
        path: 'shippingInfoId',
        populate: [
          { path: 'addressId' },
          { path: 'optionalAddressId' }
        ]
      });

    if (!order || !order.productId) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }

    const product = order.productId.toObject();

    const stockStatus = product.quantity === 0
      ? "out of stock"
      : product.quantity <= 10
      ? "low stock"
      : "active";

    const firstImageBase64 = product.productImages?.[0]
      ? product.productImages[0].toString('base64')
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
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const sellerId = req.seller?._id;
    const customerId = req.customer?._id;

    if (!orderId || !orderStatus) {
      return res.status(400).json({ message: "Order ID and orderStatus are required." });
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
        return res.status(403).json({ message: "You are not authorized to update this order." });
      }
    } else if (customerId) {
      if (String(order.customerId) !== String(customerId)) {
        return res.status(403).json({ message: "You are not authorized to update this order." });
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

    res.status(200).json({ message: "Order status updated successfully.", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.getOrderStatusCounts = async (req, res) => {
  try {
    const { seller } = req;
    const { _id: sellerId } = seller;

    const sellerProducts = await Product.find({ sellerId }, '_id');
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
          _id: '$orderStatus',
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
    console.error('Error getting order status counts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


