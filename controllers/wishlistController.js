const Wishlist = require("../models/Wishlist");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Seller = require("../models/Seller");

exports.createList = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const existing = await Wishlist.findOne({ customerId, title });
    if (existing) {
      return res.status(409).json({ message: "A wishlist with this title already exists" });
    }

    const wishlist = new Wishlist({
      customerId,
      title,
      productIds: [],
    });

    await wishlist.save();

    res.status(201).json({ message: "Wishlist created", wishlist });
  } catch (error) {
    console.error("Create list error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.addToList = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const { wishlistId, productId } = req.body;

    if (!wishlistId || !productId) {
      return res.status(400).json({ error: "wishlistId and productId are required" });
    }

    const existingWishlistWithProduct = await Wishlist.findOne({ 
      customerId, 
      productIds: productId 
    });

    if (existingWishlistWithProduct) {
      return res.status(409).json({ 
        message: "Product already exists in one of your wishlists",
        existingWishlistId: existingWishlistWithProduct._id
      });
    }

    const wishlist = await Wishlist.findOne({ _id: wishlistId, customerId });

    if (!wishlist) {
      return res.status(404).json({ error: "Wishlist not found" });
    }
    
    wishlist.productIds.push(productId);
    await wishlist.save();

    res.status(200).json({ message: "Product added to wishlist", wishlist });
  } catch (error) {
    console.error("Add to list error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllLists = async (req, res) => {
  try {
    if (req.seller) {
      return res.status(200).json({ wishlists: [] });
    }

    const { customer } = req;
    const { _id: customerId } = customer;

    const wishlists = await Wishlist.find({ customerId }).select('-__v');

    res.status(200).json({ wishlists });
  } catch (error) {
    console.error("Error fetching wishlists:", error);
    res.status(500).json({ error: "Server error" });
  }
};


exports.getWishlistItems = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;

    const wishlists = await Wishlist.find({ customerId })
      .populate({
        path: 'productIds',
        select: 'title price quantity colour model productImages'
      });

    const results = wishlists.map((list) => ({
      title: list.title,
      _id: list._id,
      products: list.productIds.map((product) => ({
        _id: product._id,
        title: product.title,
        price: product.price,
        stock: product.quantity,
        colour: product.colour,
        model: product.model,
        image:
          product.productImages?.length > 0 && Buffer.isBuffer(product.productImages[0])
            ? product.productImages[0].toString('base64')
            : null
      }))
    }));

    res.status(200).json({ lists: results });
  } catch (error) {
    console.error("Error fetching wishlist items:", error);
    res.status(500).json({ error: "Server error" });
  }
};



exports.removeFromWishlist = async (req, res) => {
  try {
    const { customer, params, body } = req;
    const { _id: customerId } = customer;
    const { id: wishlistId } = params;
    const { productId } = body;
   
    const productIdsToRemove = Array.isArray(productId) ? productId : [productId];

    const wishlist = await Wishlist.findOne({
      _id: wishlistId,
      customerId: customerId,
    });

    if (!wishlist) {
      return res.status(404).json({ error: "Wishlist not found" });
    }

    wishlist.productIds = wishlist.productIds.filter(
      pid => !productIdsToRemove.includes(pid.toString())
    );

    if (wishlist.productIds.length === 0) {
      await Wishlist.deleteOne({ _id: wishlistId });
      return res.status(200).json({ message: "Wishlist deleted as it became empty" });
    } else {
      await wishlist.save();
      return res.status(200).json({ message: "Product(s) removed from wishlist" });
    }
  } catch (error) {
    console.error("Remove wishlist item error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

