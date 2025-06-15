const Wishlist = require("../models/Wishlist");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Seller = require("../models/Seller");

exports.addToWishlist = async (req, res) => {
  console.log("Request body:", req.body);
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const existing = await Wishlist.findOne({
      userId: customerId,
      productId: productId,
    });
    if (existing) {
      return res.status(409).json({ message: "Product already in wishlist" });
    }

    const wishlistItem = new Wishlist({
      userId: customerId,
      productId: productId,
    });
    await wishlistItem.save();

    res.status(201).json({ message: "Added to wishlist" });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getWishlistItems = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;

    const wishlistItems = await Wishlist.find({ userId: customerId })
      .populate({
        path: 'productId',
        select: 'title price quantity colour model productImages sellerId',
        populate: {
          path: 'sellerId',
          select: 'name'
        }
      });

    const sellersMap = new Map();
    
    wishlistItems.forEach(item => {
      const product = item.productId;
      const seller = product.sellerId;
      
      if (!sellersMap.has(seller._id.toString())) {
        sellersMap.set(seller._id.toString(), {
          sellerId: seller._id,
          sellerName: seller.name,
          products: []
        });
      }
      
      const sellerGroup = sellersMap.get(seller._id.toString());
      
      sellerGroup.products.push({
        _id: product._id,
        title: product.title,
        price: product.price,
        stock: product.quantity,
        colour: product.colour,
        model: product.model,
        image: product.productImages?.length > 0 && Buffer.isBuffer(product.productImages[0])
          ? product.productImages[0].toString('base64')
          : null
      });
    });

    const results = Array.from(sellersMap.values());

    res.status(200).json({ sellers: results });
  } catch (error) {
    console.error("Error fetching wishlist items:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const { customer, params } = req;
    const { _id: customerId } = customer;
    const { id } = params;

    const deleted = await Wishlist.findOneAndDelete({
      _id: id,
      user: customerId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Item not found in wishlist" });
    }

    res.status(200).json({ message: "Removed from wishlist" });
  } catch (error) {
    console.error("Remove wishlist item error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
