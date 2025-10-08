import Product from '../models/Product.js';
import Wishlist from '../models/Wishlist.js';
import { processAndUploadMultipleImages, cleanupFiles, processImageToWebp, uploadImageToImageKit } from '../utils/imageKitUtils.js';
import { parseArrayField } from '../utils/validationUtils.js';

export async function createProduct(productData, files, sellerId) {
  let productImages = [];
  
  if (files && files.length > 0) {
    productImages = await processAndUploadMultipleImages(files, `product_${Date.now()}`);
  }

  const conditions = parseArrayField(productData.conditions);
  const features = parseArrayField(productData.features);
  const tags = parseArrayField(productData.tags);
  const specifications = productData.specifications ? parseArrayField(productData.specifications) : undefined;

  const product = new Product({
    title: productData.title,
    description: productData.description,
    productImages,
    category: productData.category,
    brand: productData.brand,
    model: productData.model,
    storage: productData.storage,
    colour: productData.colour,
    ram: productData.ram,
    conditions,
    features,
    price: Number(productData.price),
    salePrice: productData.salePrice ? Number(productData.salePrice) : undefined,
    quantity: Number(productData.quantity),
    sku: productData.sku,
    negotiable: productData.negotiable === 'true' || productData.negotiable === true,
    tags,
    seoTitle: productData.seoTitle,
    seoDescription: productData.seoDescription,
    specifications,
    sellerId,
  });

  await product.save();
  return product;
}

export async function getProductsBySeller(sellerId) {
  const products = await Product.find({ sellerId });

  return products.map((product) => {
    const status = product.quantity === 0 ? 'out of stock' : product.quantity <= 10 ? 'low stock' : 'active';

    return {
      _id: product._id,
      title: product.title,
      sku: product.sku,
      price: product.price,
      stock: product.quantity,
      category: product.category,
      stockStatus: status,
      status,
      image: product.productImages?.[0] || null,
    };
  });
}

export async function getProductsByIds(productIds, requestedProducts) {
  const dbProducts = await Product.find({ _id: { $in: productIds } });

  return requestedProducts.map((requestedProduct) => {
    const requestedId = requestedProduct.productId || requestedProduct.id;
    const quantity = requestedProduct.quantity;

    const dbProduct = dbProducts.find((p) => p._id.toString() === requestedId);

    if (!dbProduct) {
      return {
        _id: requestedId,
        quantity,
        error: 'Product not found',
      };
    }

    return {
      _id: dbProduct._id,
      title: dbProduct.title,
      sku: dbProduct.sku,
      price: dbProduct.price,
      quantity,
      colour: dbProduct.colour,
      model: dbProduct.model,
      image: dbProduct.productImages?.[0] || null,
    };
  });
}

export async function getProductsForShop(filters, pagination, customerId = null) {
  const { category, priceMin, priceMax, sortBy } = filters;
  const { page, limit } = pagination;

  const filter = {};
  if (category) {
    filter.category = { $regex: category, $options: 'i' };
  }

  if (priceMin || priceMax) {
    filter.price = {};
    if (priceMin !== undefined && priceMin !== '') filter.price.$gte = Number(priceMin);
    if (priceMax !== undefined && priceMax !== '') filter.price.$lte = Number(priceMax);
  }

  let sort = {};
  switch (sortBy) {
    case 'price_asc':
      sort = { price: 1 };
      break;
    case 'price_desc':
      sort = { price: -1 };
      break;
    case 'name_asc':
      sort = { title: 1 };
      break;
    case 'name_desc':
      sort = { title: -1 };
      break;
    case 'newest':
    default:
      sort = { createdAt: -1 };
      break;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [products, totalCount, categoriesAgg] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(Number(limit)).select('title sku price quantity category model colour productImages'),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ['$category', ''] } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const formattedProducts = products.map((product) => {
    let status = 'active';
    if (product.quantity === 0) {
      status = 'out-of-stock';
    } else if (product.quantity <= 10) {
      status = 'low-stock';
    }

    return {
      _id: product._id,
      image: product.productImages?.[0] || null,
      title: product.title,
      sku: product.sku,
      price: product.price,
      quantity: product.quantity,
      category: product.category,
      model: product.model,
      colour: product.colour,
      status,
      isWishlisted: false,
    };
  });

  if (customerId) {
    const wishlists = await Wishlist.find({ customerId }).select('productIds');
    const wishlistedIds = new Set(
      wishlists.flatMap((w) => (Array.isArray(w.productIds) ? w.productIds : []))
        .map((id) => id && id.toString())
    );

    formattedProducts.forEach((p) => {
      if (p && p._id && wishlistedIds.has(p._id.toString())) {
        p.isWishlisted = true;
      }
    });
  }

  const categories = Array.isArray(categoriesAgg)
    ? categoriesAgg.map((c) => (c._id ? c._id : null)).filter(Boolean)
    : undefined;

  return {
    products: formattedProducts,
    total: totalCount,
    categories: categories && categories.length > 0 ? categories : undefined,
  };
}

export async function getProductDetails(productId) {
  const product = await Product.findById(productId);
  if (!product) return null;

  const productObj = product.toObject();
  productObj.productImageStrings = productObj.productImages.map((img) => img || null);

  if (productObj.specifications && Array.isArray(productObj.specifications)) {
    productObj.specifications = productObj.specifications.map((spec) =>
      typeof spec === 'object' && spec.label && spec.value
        ? `${spec.label}: ${spec.value}`
        : spec
    );
  }

  return {
    _id: productObj._id,
    title: productObj.title,
    description: productObj.description,
    productImages: [],
    productImageStrings: productObj.productImageStrings,
    category: productObj.category,
    brand: productObj.brand,
    model: productObj.model,
    storage: productObj.storage,
    colour: productObj.colour,
    ram: productObj.ram,
    conditions: productObj.conditions || [],
    features: productObj.features || [],
    specifications: productObj.specifications || [],
    price: productObj.price,
    salePrice: productObj.salePrice || productObj.price,
    quantity: productObj.quantity,
    sku: productObj.sku,
    negotiable: productObj.negotiable || false,
    tags: productObj.tags || [],
    seoTitle: productObj.seoTitle || '',
    seoDescription: productObj.seoDescription || '',
  };
}

export async function searchProducts(query, category) {
  const searchQuery = {};

  if (category) {
    searchQuery.category = category;
  }

  const regex = new RegExp(query, 'i');
  searchQuery.$or = [
    { title: { $regex: regex } },
    { brand: { $regex: regex } },
    { tags: { $regex: regex } },
  ];

  const products = await Product.find(searchQuery);

  return products.map((product) => ({
    _id: product._id,
    title: product.title,
    price: product.price,
    stock: product.quantity,
    colour: product.colour,
    model: product.model,
    image: product.productImages?.[0] || null,
  }));
}

export async function getSingleProduct(productId, sellerId) {
  const product = await Product.findOne({ _id: productId, sellerId });
  if (!product) return null;

  const productObj = product.toObject();
  productObj.productImageStrings = productObj.productImages.map((img) => img || null);
  delete productObj.productImages;

  const quantity = productObj.quantity;
  if (quantity === 0) {
    productObj.stock = 'out of stock';
  } else if (quantity <= 10) {
    productObj.stock = 'low stock';
  } else {
    productObj.stock = 'active';
  }

  return productObj;
}

export async function deleteProduct(productId, sellerId) {
  return await Product.findOneAndDelete({
    _id: productId,
    sellerId,
  });
}

export async function updateProduct(productId, updateData, files, retainedImageUrls) {
  let finalImages = [];

  if (retainedImageUrls && Array.isArray(retainedImageUrls)) {
    retainedImageUrls.forEach((url) => {
      if (typeof url === 'string' && url.trim().length > 0) {
        finalImages.push(url);
      }
    });
  }

  if (files && files.length > 0) {
    for (const file of files) {
      const processed = await processImageToWebp(file.buffer);
      const fileName = `${Date.now()}_${file.originalname}.webp`;
      const url = await uploadImageToImageKit(processed, fileName);
      if (url) {
        finalImages.push(url);
      }
    }
  }

  updateData.productImages = finalImages;

  return await Product.findByIdAndUpdate(
    productId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
}

export function formatProductForUpdate(productData) {
  const formatted = { ...productData };
  delete formatted.productId;
  delete formatted.productImages;
  delete formatted.retainedImageHashes;

  if (formatted.price !== undefined) {
    formatted.price = parseFloat(formatted.price);
  }

  if (formatted.salePrice !== undefined && formatted.salePrice !== '') {
    formatted.salePrice = parseFloat(formatted.salePrice);
  }

  if (formatted.quantity !== undefined) {
    formatted.quantity = parseInt(formatted.quantity);
  }

  return formatted;
}
