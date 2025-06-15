const jwt = require("jsonwebtoken");
const Seller = require("../models/Seller");
const Customer = require("../models/Customer");

const auth = (userType = "seller") => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      let user;
      if (userType === "seller") {
        const { sellerId } = decoded;
        user = await Seller.findById(sellerId).select("-password");
        if (!user) {
          return res.status(401).json({ error: "Seller not found" });
        }
        req.seller = user;
      } else if (userType === "customer") {
        const { customerId } = decoded;
        user = await Customer.findById(customerId).select("-password");
        if (!user) {
          return res.status(401).json({ error: "Customer not found" });
        }
        req.customer = user;
      } else {
        return res.status(400).json({ error: "Invalid user type" });
      }

      next();
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
};

module.exports = auth;
