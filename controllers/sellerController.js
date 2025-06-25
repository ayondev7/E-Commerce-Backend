const Seller = require("../models/Seller");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const SellerNotification = require("../models/SellerNotification");
const Product = require("../models/Product");
const Order = require("../models/Order");

exports.createSeller = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").trim().notEmpty().isEmail().withMessage("Valid email is required"),
  body("password").trim().notEmpty().withMessage("Password is required"),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "Seller image is required" });
      }

      const existingSeller = await Seller.findOne({ email });
      if (existingSeller) {
        return res.status(400).json({ error: "Email already in use" });
      }

      const sellerImage = await sharp(req.file.buffer)
        .webp({
          lossless: true,
          effort: 4
        })
        .toBuffer();

      const hashedPassword = await bcrypt.hash(password, 10);

      const seller = new Seller({
        name,
        email,
        lastNotificationSeen,
        password: hashedPassword,
        sellerImage,
      });

      await seller.save();

      const accessToken = jwt.sign(
        { sellerId: seller._id },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
      );

      res.status(201).json({
        accessToken,
        sellerId: seller._id,
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Server error" });
    }
  },
];

exports.loginSeller = [
  body("email").trim().notEmpty().isEmail().withMessage("Valid email is required"),
  body("password").trim().notEmpty().withMessage("Password is required"),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const seller = await Seller.findOne({ email }).select("+password");
      if (!seller) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const { password: hashedPassword, sellerImage, ...sellerData } = seller.toObject();

      const isPasswordValid = await bcrypt.compare(password, hashedPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const { _id: sellerId } = seller;

      const accessToken = jwt.sign(
        { sellerId },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
      );

      res.status(200).json({
        accessToken,
        seller: sellerData,
      });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  },
];

exports.getAllSellers = async (req, res) => {
  try {
    const sellers = await Seller.find().select("-password");

    const sellersWithImages = sellers.map((seller) => {
      const { sellerImage, ...sellerData } = seller.toObject();
      return {
        ...sellerData,
        sellerImage: sellerImage ? sellerImage.toString("base64") : null,
      };
    });

    res.status(200).json(sellersWithImages);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getSellerProfile = async (req, res) => {
  try {
    const { seller } = req;

    if (!seller || !seller._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Seller not found in request",
      });
    }

    const foundSeller = await Seller.findById(seller._id);

    if (!foundSeller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const { password, sellerImage, ...rest } = foundSeller.toObject();

    return res.status(200).json({
      success: true,
      data: {
        ...rest,
        image: sellerImage ? sellerImage.toString('base64') : null,
      },
    });

  } catch (error) {
    console.error("Error fetching seller profile:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching seller profile",
    });
  }
};

exports.getSellerNotifications = async (req, res) => {
  const sellerId = req.seller?._id;

  if (!sellerId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const seller = await Seller.findById(sellerId);
  const lastSeenId = seller?.lastNotificationSeen;

  const notifications = await SellerNotification.find({ sellerId }).sort({ createdAt: -1 });

  const response = notifications.map((notification) => ({
    ...notification.toObject(),
    isNew: lastSeenId ? notification._id > lastSeenId : true,
  }));

  res.status(200).json({ success: true, notifications: response });
};

exports.updateLastNotificationSeen = async (req, res) => {
  const sellerId = req.seller?._id;
  const { lastSeenNotificationId } = req.body;

  if (!sellerId || !lastSeenNotificationId) {
    return res.status(400).json({ success: false, message: 'Missing seller ID or notification ID' });
  }

  await Seller.findByIdAndUpdate(sellerId, {
    lastNotificationSeen: lastSeenNotificationId,
  });

  res.status(200).json({ success: true, message: 'Last seen notification updated successfully' });
};

exports.getSellerPayments = async (req, res) => {
  try {
    const { seller } = req;
    const sellerId = seller?._id;

    if (!sellerId) {
      return res.status(400).json({ message: "Seller ID is required" });
    }

    const sellerProducts = await Product.find({ sellerId }).select("_id title").lean();

    const productIdToTitleMap = {};
    const sellerProductIds = sellerProducts.map((product) => {
      productIdToTitleMap[product._id.toString()] = product.title;
      return product._id;
    });

    const orders = await Order.find({ productId: { $in: sellerProductIds } }).lean();

    const payments = orders.map((order) => ({
      ...order,
      productTitle: productIdToTitleMap[order.productId.toString()] || null,
    }));

    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("Error fetching seller payments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
