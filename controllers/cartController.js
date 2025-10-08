import * as cartService from '../services/cartServices.js';
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
        skipped.push({ wishlistId, reason: 'Missing wishlistId or productId' });
        continue;
      }

      const wishlist = await Wishlist.findById(wishlistId);
      if (!wishlist) {
        skipped.push({ wishlistId, reason: 'Wishlist not found' });
        continue;
      }

      const productIds = Array.isArray(productId) ? productId : [productId];
      const result = await cartService.processWishlistToCart(customerId, wishlist, productIds);

      added.push(...result.added);
      skipped.push(...result.skipped);

      if (result.productsToRemove.length > 0) {
        const removeResult = await cartService.removeProductsFromWishlist(wishlistId, result.productsToRemove);
        if (removeResult.deleted) {
          deletedWishlistIds.push(wishlistId);
        } else if (removeResult.updated) {
          updatedWishlistIds.push(wishlistId);
        }
      }
    }

    res.status(201).json({
      message: 'Processed add to cart request',
      addedCount: added.length,
      skippedCount: skipped.length,
      deletedWishlistIds,
      updatedWishlistIds,
      added,
      skipped,
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Server error' });
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

    const result = await cartService.addProductToCart(customerId, productId);

    if (!result.success) {
      return res.status(result.error ? 404 : 200).json(result.error ? { error: result.error } : { message: result.message });
    }

    return res.status(201).json({ message: 'Product added to cart', cartId: result.cartId });
  } catch (error) {
    console.error('addProductDirect error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getCartItems = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;

    const carts = await cartService.getCartsByCustomer(customerId);
    const result = cartService.formatCartProducts(carts);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const { customer, body } = req;
    const { _id: customerId } = customer;
    const { cartId, productId } = body;

    if (!productId || (Array.isArray(productId) && productId.length === 0)) {
      return res.status(400).json({ error: 'No productId(s) provided' });
    }

    if (!cartId || (Array.isArray(cartId) && cartId.length === 0)) {
      return res.status(400).json({ error: 'No cartId(s) provided' });
    }

    const cartIdsToProcess = Array.isArray(cartId) ? cartId : [cartId];
    const productIdsToRemove = Array.isArray(productId) ? productId : [productId];

    const stats = await cartService.removeProductsFromCarts(customerId, cartIdsToProcess, productIdsToRemove);

    let message = 'Operation completed';
    if (stats.cartsModified > 0 && stats.cartsDeleted > 0) {
      message = `Items removed from ${stats.cartsModified} cart(s) and ${stats.cartsDeleted} empty cart(s) deleted`;
    } else if (stats.cartsModified > 0) {
      message = `Items removed from ${stats.cartsModified} cart(s)`;
    } else if (stats.cartsDeleted > 0) {
      message = `${stats.cartsDeleted} empty cart(s) deleted`;
    } else {
      message = 'No changes made - requested items not found in specified carts';
    }

    res.status(200).json({ message, stats });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateCartItemQuantity = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const { id, quantity } = req.body;

    if (!id || !quantity) {
      return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const cartItem = await cartService.updateCartItemQuantity(customerId, id, quantity);

    res.status(200).json({
      message: 'Cart item quantity updated successfully',
      cartItem: {
        _id: cartItem._id,
        productId: cartItem.productId,
        quantity: cartItem.quantity
      }
    });
  } catch (error) {
    console.error('Update cart item quantity error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Cart item already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
