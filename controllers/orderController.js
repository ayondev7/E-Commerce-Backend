const Address = require('../models/Address');
const ShippingInfo = require('../models/ShippingInfo');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');

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
      checkoutPayload
    } = req.body;

    const customerId = req.customer?._id;

    if (!customerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
    }

    if (!checkoutPayload || !checkoutPayload.products || checkoutPayload.products.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Products are required in checkout payload'
      });
    }

    let shippingInfoId;
    let primaryAddressId = addressId;
    let optionalAddressId = null;

    // Handle address creation if addressId is not provided
    if (!addressId) {
      if (!addressLine1 || !city || !zipCode || !country) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Address details are required when addressId is not provided'
        });
      }

      const primaryAddress = new Address({
        customerId,
        name: name || 'Unnamed',
        addressLine: addressLine1,
        city,
        zipCode,
        country,
        state: state || '',
        isDefault: false
      });

      const savedPrimaryAddress = await primaryAddress.save({ session });
      primaryAddressId = savedPrimaryAddress._id;

      if (addressLine2 && addressLine2.trim() !== '') {
        const optionalAddress = new Address({
          customerId,
          name: name || 'Unnamed',
          addressLine: addressLine2,
          city,
          zipCode,
          country,
          state: state || '',
          isDefault: false
        });

        const savedOptionalAddress = await optionalAddress.save({ session });
        optionalAddressId = savedOptionalAddress._id;
      }
    }

    // Create shipping info
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

    // Create orders for each product
    const createdOrders = [];
    const products = checkoutPayload.products;

    for (const product of products) {
      const { productId, quantity, price } = product;

      if (!productId || !quantity || price === undefined) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Each product must have productId, quantity, and price'
        });
      }

      const order = new Order({
        customerId,
        productId,
        quantity,
        price,
        paymentMethod,
        shippingInfoId,
        paymentStatus: 'pending',
        orderStatus: 'pending'
      });

      const savedOrder = await order.save({ session });
      createdOrders.push(savedOrder);
    }

    // Remove ordered productIds from cart
    const orderedProductIds = products.map(p => p.productId);

    const carts = await Cart.find({ customerId }).session(session);

    for (const cart of carts) {
      const productIdsArray = Array.isArray(cart.productIds)
        ? cart.productIds.map(id => id.toString())
        : [cart.productIds.toString()];

      const remaining = productIdsArray.filter(id => !orderedProductIds.includes(id));

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
      message: 'Orders created successfully',
      data: {
        orders: createdOrders,
        shippingInfo: savedShippingInfo,
        addresses: {
          primary: primaryAddressId,
          optional: optionalAddressId
        },
        orderSummary: {
          totalOrders: createdOrders.length,
          subtotal: checkoutPayload.subtotal,
          shipping: checkoutPayload.shipping || 0,
          tax: checkoutPayload.tax || 0,
          total: checkoutPayload.total,
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error creating order:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};
