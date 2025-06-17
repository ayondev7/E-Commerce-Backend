const Cart = require("../models/Cart");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Seller = require("../models/Seller");
const Wishlist = require("../models/Wishlist");

exports.addToCart = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    let entries = Array.isArray(req.body) ? req.body : [req.body];

    const added = [];
    const skipped = [];
    const deletedWishlistIds = [];
    const updatedWishlistIds = [];

    for (const entry of entries) {
      const { wishlistId, productId } = entry;

      if (!wishlistId || !productId) {
        skipped.push({ wishlistId, reason: "Missing wishlistId or productId" });
        continue;
      }

     
      const wishlist = await Wishlist.findById(wishlistId);
      if (!wishlist) {
        skipped.push({ wishlistId, reason: "Wishlist not found" });
        continue;
      }

      const title = wishlist.title;
      const productIds = Array.isArray(productId) ? productId : [productId];

      let cart = await Cart.findOne({ customerId, title }) || 
                 new Cart({ customerId, title, productIds: [] });

      const productsToRemoveFromWishlist = [];

      for (const pid of productIds) {
        if (cart.productIds.includes(pid)) {
          skipped.push({ title, productId: pid, reason: "Already in cart" });
        } else {
          cart.productIds.push(pid);
          added.push({ title, productId: pid });
          productsToRemoveFromWishlist.push(pid);
        }
      }

      await cart.save();

      if (productsToRemoveFromWishlist.length > 0) {
        wishlist.productIds = wishlist.productIds.filter(
          id => !productsToRemoveFromWishlist.includes(id.toString())
        );

        if (wishlist.productIds.length === 0) {
          await Wishlist.findByIdAndDelete(wishlistId);
          deletedWishlistIds.push(wishlistId);
        } else {
          await wishlist.save();
          updatedWishlistIds.push(wishlistId);
        }
      }
    }

    res.status(201).json({
      message: "Processed add to cart request",
      addedCount: added.length,
      skippedCount: skipped.length,
      deletedWishlistIds,
      updatedWishlistIds,
      added,
      skipped,
    });

  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: "Server error" });
  }
};



exports.getCartItems = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;

    console.log("customerId", customerId);

    const carts = await Cart.find({ customerId }).populate({
      path: 'productIds',
      select: 'title price quantity colour model productImages'
    });

    const grouped = {};
    let totalProductsCount = 0;

    for (const cart of carts) {
      const title = cart.title;

      if (!title) continue;

      if (!grouped[title]) {
        grouped[title] = {
          title,
          products: []
        };
      }

      const products = cart.productIds.map((product) => ({
        _id: product._id,
        title: product.title,
        price: product.price,
        stock: product.quantity,
        colour: product.colour,
        model: product.model,
        image:
          product.productImages?.length > 0 && Buffer.isBuffer(product.productImages[0])
            ? product.productImages[0].toString("base64")
            : null
      }));

      grouped[title].products.push(...products);
      totalProductsCount += products.length;
    }

    const results = Object.values(grouped);

    res.status(200).json({ 
      lists: results,
      productsCount: totalProductsCount 
    });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({ error: "Server error" });
  }
};



exports.removeFromCart = async (req, res) => {
  try {
    const { customer, params } = req;
    const { _id: customerId } = customer;
    const { id } = params;

    const deleted = await Cart.findOneAndDelete({
      _id: id,
      customerId: customerId,  
    });

    if (!deleted) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    res.status(200).json({ message: "Removed from cart" });
  } catch (error) {
    console.error("Remove cart item error:", error);
    res.status(500).json({ error: "Server error" });
  }
};