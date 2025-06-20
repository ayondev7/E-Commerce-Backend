const jwt = require("jsonwebtoken");
const Seller = require("../models/Seller");
const Customer = require("../models/Customer");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sellerId) {
      const seller = await Seller.findById(decoded.sellerId).select("-password");
      if (seller) {
        req.seller = seller;
        return next();
      }
    }

    if (decoded.customerId) {
      const customer = await Customer.findById(decoded.customerId).select("-password");
      if (customer) {
        req.customer = customer;
        return next();
      }
    }

    return res.status(401).json({ error: "Invalid token: user not found" });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = auth;
