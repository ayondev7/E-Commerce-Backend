import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import RecentActivity from '../models/RecentActivity.js';

export async function createWishlist(customerId, title) {
  const wishlist = new Wishlist({
    customerId,
    title,
    productIds: [],
  });

  await wishlist.save();
  return wishlist;
}

export async function findWishlistByCustomerAndTitle(customerId, title) {
  return await Wishlist.findOne({ customerId, title });
}

export async function findWishlistWithProduct(customerId, productId) {
  return await Wishlist.findOne({ 
    customerId, 
    productIds: productId 
  });
}

export async function addProductToWishlist(wishlistId, customerId, productId) {
  const wishlist = await Wishlist.findOne({ _id: wishlistId, customerId });
  if (!wishlist) return null;
  
  wishlist.productIds.push(productId);
  await wishlist.save();
  return wishlist;
}

export async function getWishlistsByCustomer(customerId) {
  return await Wishlist.find({ customerId }).select('-__v');
}

export async function getWishlistItemsByCustomer(customerId) {
  const wishlists = await Wishlist.find({ customerId })
    .populate({
      path: 'productIds',
      select: 'title price quantity colour model productImages'
    });

  return wishlists.map((list) => ({
    title: list.title,
    _id: list._id,
    products: list.productIds.map((product) => ({
      _id: product._id,
      title: product.title,
      price: product.price,
      stock: product.quantity,
      colour: product.colour,
      model: product.model,
      image: product.productImages?.length > 0 ? product.productImages[0] : null
    }))
  }));
}

export async function removeProductsFromWishlist(wishlistId, customerId, productIds) {
  const wishlist = await Wishlist.findOne({
    _id: wishlistId,
    customerId,
  });

  if (!wishlist) return null;

  wishlist.productIds = wishlist.productIds.filter(
    pid => !productIds.includes(pid.toString())
  );

  if (wishlist.productIds.length === 0) {
    await Wishlist.deleteOne({ _id: wishlistId });
    return { deleted: true };
  } else {
    await wishlist.save();
    return { deleted: false, wishlist };
  }
}

export async function createWishlistActivity(customerId, wishlistId, activityType, productTitle) {
  await RecentActivity.create({
    customerId,
    wishlistId,
    activityType,
    activityStatus: activityType === 'added to wishlist' 
      ? `You added '${productTitle}' to your wishlist`
      : `You removed '${productTitle}' from your wishlist`,
  });
}

export async function getProductTitle(productId) {
  const product = await Product.findById(productId).select('title');
  return product ? product.title : 'the product';
}
