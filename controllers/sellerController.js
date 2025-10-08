import Seller from '../models/Seller.js';
import { validationResult } from 'express-validator';
import { createSellerValidators, loginSellerValidators } from '../validators/sellerValidators.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import ImageKit from 'imagekit';
import SellerNotification from '../models/SellerNotification.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js'; 

function getImageKitInstance() {
  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } =
    process.env;
  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
    return null;
  }
  return new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  });
}

export const createSeller = [
  ...createSellerValidators,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, phone } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "Seller image is required" });
      }

      const existingSeller = await Seller.findOne({ email });
      if (existingSeller) {
        return res.status(400).json({ error: "Email already in use" });
      }
      let sellerImageUrl = null;
      const imageKit = getImageKitInstance();
      if (imageKit) {
        try {
          const webpBuffer = await sharp(req.file.buffer)
            .webp({ lossless: true })
            .toBuffer();

          const fileName = `${name.replace(/\s+/g, "_")}_${Date.now()}.webp`;

          const uploadResult = await imageKit.upload({
            file: webpBuffer,
            fileName,
            useUniqueFileName: true,
          });

          sellerImageUrl = uploadResult.url;
        } catch (uploadErr) {
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const seller = new Seller({
        name,
        email,
        phone,
        lastNotificationSeen: null,
        password: hashedPassword,
        sellerImage: sellerImageUrl,
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
      if (error && error.name === "ValidationError") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Server error", details: (error && error.message) || null });
    }
  },
];

export const loginSeller = [
  ...loginSellerValidators,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const seller = await Seller.findOne({ email }).select("+password");
      if (!seller) {
        return res.status(401).json({ error: "Invalid email" });
      }

      const {
        password: hashedPassword,
        sellerImage,
        ...sellerData
      } = seller.toObject();

      const isPasswordValid = await bcrypt.compare(password, hashedPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid password" });
      }

      const { _id: sellerId } = seller;

      const accessToken = jwt.sign({ sellerId }, process.env.JWT_SECRET, {
        expiresIn: "3h",
      });

      res.status(200).json({
        accessToken,
        seller: sellerData,
      });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  },
];

export const getAllSellers = async (req, res) => {
  try {
    const sellers = await Seller.find().select("-password");

    const sellersWithImages = sellers.map((seller) => {
      const { sellerImage, ...sellerData } = seller.toObject();
      return {
        ...sellerData,
        sellerImage: sellerImage || null,
      };
    });

    res.status(200).json(sellersWithImages);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const getSellerProfile = async (req, res) => {
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
        image: sellerImage || null,
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

export const getSellerNotifications = async (req, res) => {
  const sellerId = req.seller?._id;

  if (!sellerId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const seller = await Seller.findById(sellerId);
  const lastSeenId = seller?.lastNotificationSeen;

  const notifications = await SellerNotification.find({ sellerId }).sort({
    createdAt: -1,
  });

  const response = notifications.map((notification) => ({
    ...notification.toObject(),
    isNew: lastSeenId ? notification._id > lastSeenId : true,
  }));

  res.status(200).json({ success: true, notifications: response });
};

export const updateLastNotificationSeen = async (req, res) => {
  const sellerId = req.seller?._id;
  const { lastSeenNotificationId } = req.body;

  if (!sellerId || !lastSeenNotificationId) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Missing seller ID or notification ID",
      });
  }

  await Seller.findByIdAndUpdate(sellerId, {
    lastNotificationSeen: lastSeenNotificationId,
  });

  res
    .status(200)
    .json({
      success: true,
      message: "Last seen notification updated successfully",
    });
};

export const getSellerPayments = async (req, res) => {
  try {
    const { seller } = req;
    const sellerId = seller?._id;

    if (!sellerId) {
      return res.status(400).json({ message: "Seller ID is required" });
    }

    const sellerProducts = await Product.find({ sellerId })
      .select("_id title")
      .lean();

    const productIdToTitleMap = {};
    const sellerProductIds = sellerProducts.map((product) => {
      productIdToTitleMap[product._id.toString()] = product.title;
      return product._id;
    });

    const orders = await Order.find({
      productId: { $in: sellerProductIds },
    }).lean();

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

export const guestSellerLogin = async (req, res) => {
  try {
    const guestEmail = process.env.GUEST_SELLER_EMAIL;
    const guestPassword = process.env.GUEST_PASSWORD;

    if (!guestEmail || !guestPassword) {
      return res
        .status(500)
        .json({ error: "Guest credentials are not configured" });
    }

    const seller = await Seller.findOne({ email: guestEmail }).select(
      "+password"
    );
    if (!seller) {
      return res.status(404).json({ error: "Guest seller not found" });
    }

    const isMatch = await bcrypt.compare(guestPassword, seller.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Guest authentication failed" });
    }

    const {
      password: hashedPassword,
      sellerImage,
      ...sellerData
    } = seller.toObject();

    const accessToken = jwt.sign(
      { sellerId: seller._id },
      process.env.JWT_SECRET,
      { expiresIn: "3h" }
    );

    return res.status(200).json({ accessToken, seller: sellerData });
  } catch (error) {
    console.error("Guest seller login error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};
