const Seller = require("../models/Seller");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");

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

      const responseSellerData = {
        ...sellerData,
        sellerImage: sellerImage ? sellerImage.toString("base64") : null,
      };

      res.status(200).json({
        accessToken,
        seller: responseSellerData,
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