import * as wishlistService from '../services/wishlistServices.js';

export const createList = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const existing = await wishlistService.findWishlistByCustomerAndTitle(customerId, title);
    if (existing) {
      return res.status(409).json({ message: 'A wishlist with this title already exists' });
    }

    const wishlist = await wishlistService.createWishlist(customerId, title);
    res.status(201).json({ message: 'Wishlist created', wishlist });
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const addToList = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const { wishlistId, productId } = req.body;

    if (!wishlistId || !productId) {
      return res.status(400).json({ error: 'wishlistId and productId are required' });
    }

    const existingWishlistWithProduct = await wishlistService.findWishlistWithProduct(customerId, productId);

    if (existingWishlistWithProduct) {
      return res.status(409).json({ 
        message: 'Product already exists in one of your wishlists',
        existingWishlistId: existingWishlistWithProduct._id
      });
    }

    const wishlist = await wishlistService.addProductToWishlist(wishlistId, customerId, productId);

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    const productTitle = await wishlistService.getProductTitle(productId);
    await wishlistService.createWishlistActivity(customerId, wishlistId, 'added to wishlist', productTitle);

    res.status(200).json({ message: 'Product added to wishlist', wishlist });
  } catch (error) {
    console.error('Add to list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getAllLists = async (req, res) => {
  try {
    if (req.seller) {
      return res.status(200).json({ wishlists: [] });
    }

    const { customer } = req;
    const { _id: customerId } = customer;

    const wishlists = await wishlistService.getWishlistsByCustomer(customerId);
    res.status(200).json({ wishlists });
  } catch (error) {
    console.error('Error fetching wishlists:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getWishlistItems = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;

    const results = await wishlistService.getWishlistItemsByCustomer(customerId);
    res.status(200).json({ lists: results });
  } catch (error) {
    console.error('Error fetching wishlist items:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const { customer, params, body } = req;
    const { _id: customerId } = customer;
    const { id: wishlistId } = params;
    const { productId } = body;

    const productIdsToRemove = Array.isArray(productId) ? productId : [productId];

    const result = await wishlistService.removeProductsFromWishlist(wishlistId, customerId, productIdsToRemove);

    if (!result) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    for (const pid of productIdsToRemove) {
      const productTitle = await wishlistService.getProductTitle(pid);
      await wishlistService.createWishlistActivity(customerId, wishlistId, 'removed from wishlist', productTitle);
    }

    if (result.deleted) {
      return res.status(200).json({ message: 'Wishlist deleted as it became empty' });
    } else {
      return res.status(200).json({ message: 'Product(s) removed from wishlist' });
    }
  } catch (error) {
    console.error('Remove wishlist item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

