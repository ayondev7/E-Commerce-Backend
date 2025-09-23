import Cart from '../models/Cart.js';
import CartItem from '../models/CartItem.js';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';
import Wishlist from '../models/Wishlist.js';

export const addToCart = async (req, res) => {
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

export const addProductDirect = async (req, res) => {
  try {
    const { customer } = req;
    const customerId = customer?._id;
    const { productId } = req.body;

    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const product = await Product.findById(productId).select('category');
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const title = product.category || '';

    // Find existing cart with same title for this customer or create new
    let cart = await Cart.findOne({ customerId, title });
    if (!cart) {
      cart = new Cart({ customerId, title, productIds: [] });
    }

    if (cart.productIds.map(String).includes(String(productId))) {
      return res.status(200).json({ message: 'Product already in cart' });
    }

    cart.productIds.push(productId);
    await cart.save();

    return res.status(201).json({ message: 'Product added to cart', cartId: cart._id });
  } catch (error) {
    console.error('addProductDirect error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getCartItems = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;

    const carts = await Cart.find({ customerId }).populate({
      path: "productIds",
      select: "title price quantity colour model productImages",
    });

    const grouped = {};
    let totalProductsCount = 0;

    for (const cart of carts) {
      const title = cart.title && cart.title.trim() ? cart.title.trim() : null;
      const groupKey = title || `cart_${cart._id.toString()}`;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          // Display an empty string when title is missing to match frontend expectations
          title: title || '',
          _id: cart._id,
          products: [],
        };
      }

      const products = cart.productIds.map((product) => ({
        _id: product._id,
        title: product.title,
        price: product.price,
        stock: product.quantity,
        colour: product.colour,
        model: product.model,
        image: product.productImages?.length > 0 ? product.productImages[0] : null,
      }));

      grouped[groupKey].products.push(...products);
      totalProductsCount += products.length;
    }

    const results = Object.values(grouped);

    res.status(200).json({
      lists: results,
      productsCount: totalProductsCount,
    });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({ error: "Server error" });
  }
};


export const removeFromCart = async (req, res) => {
  try {
    const { customer, body } = req;
    const { _id: customerId } = customer;
    const { cartId, productId } = body;

    if (!productId || (Array.isArray(productId) && productId.length === 0)) {
      return res.status(400).json({ error: "No productId(s) provided" });
    }

    if (!cartId || (Array.isArray(cartId) && cartId.length === 0)) {
      return res.status(400).json({ error: "No cartId(s) provided" });
    }

  
    const cartIdsToProcess = Array.isArray(cartId) ? cartId : [cartId];
    const productIdsToRemove = Array.isArray(productId) ? productId : [productId];

   
    const carts = await Cart.find({ 
      _id: { $in: cartIdsToProcess }, 
      customerId 
    });

    if (!carts || carts.length === 0) {
      return res.status(404).json({ error: "No carts found" });
    }

    let cartsModified = 0;
    let cartsDeleted = 0;

   
    for (const cart of carts) {
      const initialLength = cart.productIds.length;
      
    
      cart.productIds = cart.productIds.filter(
        (p) => !productIdsToRemove.includes(p.toString())
      );

      if (cart.productIds.length !== initialLength) {
        cartsModified++;
      }

      if (cart.productIds.length === 0) {
        await Cart.deleteOne({ _id: cart._id });
        cartsDeleted++;
        cartsModified--; 
      } else {
        await cart.save();
      }
    }

    let message = "Operation completed";
    if (cartsModified > 0 && cartsDeleted > 0) {
      message = `Items removed from ${cartsModified} cart(s) and ${cartsDeleted} empty cart(s) deleted`;
    } else if (cartsModified > 0) {
      message = `Items removed from ${cartsModified} cart(s)`;
    } else if (cartsDeleted > 0) {
      message = `${cartsDeleted} empty cart(s) deleted`;
    } else {
      message = "No changes made - requested items not found in specified carts";
    }

    res.status(200).json({ 
      message,
      stats: {
        cartsProcessed: carts.length,
        cartsModified,
        cartsDeleted
      }
    });
  } catch (error) {
    console.error("Remove cart item error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// New endpoint for updating cart item quantities
export const updateCartItemQuantity = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const { id, quantity } = req.body;

    if (!id || !quantity) {
      return res.status(400).json({ error: "Product ID and quantity are required" });
    }

    if (quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    // Find or create cart item
    let cartItem = await CartItem.findOne({ 
      customerId, 
      productId: id 
    });

    if (!cartItem) {
      // Create new cart item if it doesn't exist
      cartItem = new CartItem({
        customerId,
        productId: id,
        quantity
      });
    } else {
      // Update existing cart item
      cartItem.quantity = quantity;
    }

    await cartItem.save();

    res.status(200).json({
      message: "Cart item quantity updated successfully",
      cartItem: {
        _id: cartItem._id,
        productId: cartItem.productId,
        quantity: cartItem.quantity
      }
    });

  } catch (error) {
    console.error("Update cart item quantity error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Cart item already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
};
