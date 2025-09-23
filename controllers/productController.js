import Product from '../models/Product.js';
import { validationResult } from 'express-validator';
import { baseProductValidators } from '../validators/productValidators.js';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
const fsp = fs.promises;
import path from 'path';
import { uploadToImageKit } from '../utils/imagekitClient.js';

export const createProduct = [
  ...baseProductValidators,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.seller || !req.seller._id) {
        return res.status(403).json({ error: "Unauthorized!" });
      }

      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one product image is required" });
      }

      let productImages = [];
      if (req.files && req.files.length > 0) {
        if (req.files.length > 4) {
          return res.status(400).json({ error: "Maximum 4 images allowed" });
        }

        for (const file of req.files) {
          const processed = await sharp(file.buffer)
            .webp({ lossless: true, effort: 4 })
            .toBuffer();

          // Upload to ImageKit (guarded)
          try {
            const uploadResult = await uploadToImageKit({
              file: processed,
              fileName: `${Date.now()}_${file.originalname}.webp`,
              useUniqueFileName: true,
            });
            if (uploadResult && uploadResult.url) productImages.push(uploadResult.url);
          } catch (uploadErr) {
            console.error('ImageKit upload error for product image:', uploadErr);
          }
        }
      }

      const parseField = (field) => {
        if (!field) return [];
        if (typeof field === "string") {
          try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return [field];
          }
        }
        return Array.isArray(field) ? field : [field];
      };

      const conditions = parseField(req.body.conditions);
      const features = parseField(req.body.features);
      const tags = parseField(req.body.tags);
      const specifications = req.body.specifications
        ? parseField(req.body.specifications)
        : undefined;

      const product = new Product({
        title: req.body.title,
        description: req.body.description,
        productImages,
        category: req.body.category,
        brand: req.body.brand,
        model: req.body.model,
        storage: req.body.storage,
        colour: req.body.colour,
        ram: req.body.ram,
        conditions,
        features,
        price: Number(req.body.price),
        salePrice: req.body.salePrice ? Number(req.body.salePrice) : undefined,
        quantity: Number(req.body.quantity),
        sku: req.body.sku,
        negotiable:
          req.body.negotiable === "true" || req.body.negotiable === true,
        tags,
        seoTitle: req.body.seoTitle,
        seoDescription: req.body.seoDescription,
        specifications,
        sellerId: req.seller._id,
      });

      await product.save();

      res.status(201).json({
        message: "Product created successfully",
        productId: product._id,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: "SKU already exists" });
      }
      if (err.name === "ValidationError") {
        return res.status(400).json({ error: err.message });
      }
      if (err instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid JSON in request body" });
      }
      console.error("Product creation error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
];

export const getAllProducts = async (req, res) => {
  if (!req.seller || !req.seller._id) {
    return res.status(403).json({ error: "Unauthorized!" });
  }
  const sellerId = req.seller._id;
  try {
    const products = await Product.find({ sellerId });

    const formattedProducts = products.map((product) => {
      const status =
        product.quantity === 0
          ? "out of stock"
          : product.quantity <= 10
          ? "low stock"
          : "active";

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

    res.status(200).json({ products: formattedProducts });
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getAllProductsById = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "No products provided" });
    }

    const productIds = products.map((p) => p.productId || p.id);

    const dbProducts = await Product.find({ _id: { $in: productIds } });

    const formattedProducts = products.map((requestedProduct) => {
      const requestedId = requestedProduct.productId || requestedProduct.id;
      const quantity = requestedProduct.quantity;

      const dbProduct = dbProducts.find(
        (p) => p._id.toString() === requestedId
      );

      if (!dbProduct) {
        return {
          _id: requestedId,
          quantity,
          error: "Product not found",
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

    res.status(200).json({ products: formattedProducts });
  } catch (error) {
    console.error("Get products by ID(s) error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Product endpoints for frontend consumption
export const getAllProductsForShop = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      priceMin,
      priceMax,
      sortBy = 'newest'
    } = req.query;

    // Build filter query
    const filter = {};
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }
    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }

    // Build sort query
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

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [products, totalCount] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .select('title sku price quantity category model colour productImages'),
      Product.countDocuments(filter)
    ]);

    const formattedProducts = products.map((product) => {
      let status = "active";
      if (product.quantity === 0) {
        status = "out-of-stock";
      } else if (product.quantity <= 10) {
        status = "low-stock";
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
        status
      };
    });

    res.status(200).json({
      products: formattedProducts,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalProducts: totalCount,
        hasNextPage: skip + Number(limit) < totalCount,
        hasPrevPage: Number(page) > 1
      }
    });
  } catch (error) {
    console.error("Get shop products error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const productObj = product.toObject();

    // productImages already stores URLs; copy to productImageStrings for frontend
    productObj.productImageStrings = productObj.productImages.map((img) => img || null);

    // Do not keep raw productImages buffers (now URLs)

    // Convert specifications array to the expected format
    if (productObj.specifications && Array.isArray(productObj.specifications)) {
      productObj.specifications = productObj.specifications.map(spec => 
        typeof spec === 'object' && spec.label && spec.value 
          ? `${spec.label}: ${spec.value}`
          : spec
      );
    }

    // Ensure all required fields are present and properly formatted
    const response = {
      _id: productObj._id,
      title: productObj.title,
      description: productObj.description,
  productImages: [], // Empty array as requested
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
      seoTitle: productObj.seoTitle || "",
      seoDescription: productObj.seoDescription || ""
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching product details:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const searchProducts = async (req, res) => {
  if (!req.seller && !req.customer) {
    return res.status(403).json({ error: "Unauthorized!" });
  }

  try {
    const { category, keyword } = req.query;
    const query = {};

    if (!keyword || keyword.trim() === "") {
      return res.status(200).json({ products: [] });
    }

    if (category) {
      query.category = category;
    }

    const regex = new RegExp(keyword, "i");
    query.$or = [
      { title: { $regex: regex } },
      { brand: { $regex: regex } },
      { tags: { $regex: regex } },
    ];

    const products = await Product.find(query);

    const formattedProducts = products.map((product) => ({
      _id: product._id,
      title: product.title,
      price: product.price,
      stock: product.quantity,
      colour: product.colour,
      model: product.model,
      image: product.productImages?.[0] || null,
    }));

    res.status(200).json({ products: formattedProducts });
  } catch (error) {
    console.error("Product search error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.seller?._id;

    if (!sellerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const product = await Product.findOne({
      _id: id,
      sellerId,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const productObj = product.toObject();

    productObj.productImageStrings = productObj.productImages.map((img) => img || null);

    delete productObj.productImages;

    const quantity = productObj.quantity;
    if (quantity === 0) {
      productObj.stock = "out of stock";
    } else if (quantity <= 10) {
      productObj.stock = "low stock";
    } else {
      productObj.stock = "active";
    }

    return res.status(200).json(productObj);
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { seller } = req;
    const { _id: sellerId } = seller;
    const { id: productId } = req.params;

    if (!sellerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const product = await Product.findOneAndDelete({
      _id: productId,
      sellerId: sellerId,
    });

    if (!product) {
      return res
        .status(404)
        .json({ error: "Product not found or not authorized" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find({
      category: new RegExp(category, "i"),
      sellerId: req.sellerId,
    })
      .populate("sellerId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments({
      category: new RegExp(category, "i"),
      sellerId: req.sellerId,
    });

    const productsWithImages = products.map((product) => {
      const productObj = product.toObject();
      return {
        ...productObj,
        productImages: productObj.productImages.map((img) => img || null),
      };
    });

    res.status(200).json({
      products: productsWithImages,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalProducts: total,
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get products by category error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getProductStats = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      { $match: { sellerId: req.sellerId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: { $sum: "$price" },
          averagePrice: { $avg: "$price" },
          totalQuantity: { $sum: "$quantity" },
          categories: { $addToSet: "$category" },
          brands: { $addToSet: "$brand" },
        },
      },
    ]);

    const categoryStats = await Product.aggregate([
      { $match: { sellerId: req.sellerId } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalValue: { $sum: "$price" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      overview: stats[0] || {
        totalProducts: 0,
        totalValue: 0,
        averagePrice: 0,
        totalQuantity: 0,
        categories: [],
        brands: [],
      },
      categoryBreakdown: categoryStats,
    });
  } catch (error) {
    console.error("Get product stats error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const generateImageHash = (buffer) => {
  return crypto.createHash("md5").update(buffer).digest("hex");
};

async function fileToBuffer(file) {
  if (file?.buffer) {
    return file.buffer;
  } else if (file?.path) {
    return await fs.readFile(file.path);
  } else {
    throw new TypeError("Invalid file input: missing buffer or path");
  }
}

const isValidBuffer = (buffer) => {
  return Buffer.isBuffer(buffer) && buffer.length > 100;
};

async function cleanupFiles(files = []) {
  if (!Array.isArray(files)) return;

  await Promise.all(
    files.map(async (file) => {
      if (file?.path) {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.error(
            `Failed to delete temp file ${file.path}:`,
            err.message
          );
        }
      }
    })
  );
}

export const updateProduct = async (req, res) => {
  try {
    const { productId, retainedImageHashes = [] } = req.body;

    if (!productId) {
      await cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      await cleanupFiles(req.files);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const updateData = { ...req.body };
    delete updateData.productId;
    delete updateData.productImages;
    delete updateData.retainedImageHashes;

    if (updateData.price !== undefined) {
      const price = parseFloat(updateData.price);
      if (isNaN(price) || price < 0) {
        await cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: "Invalid price value",
        });
      }
      updateData.price = price;
    }

    if (updateData.salePrice !== undefined && updateData.salePrice !== "") {
      const salePrice = parseFloat(updateData.salePrice);
      if (isNaN(salePrice) || salePrice < 0) {
        await cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: "Invalid sale price value",
        });
      }
      updateData.salePrice = salePrice;
    }

    if (updateData.quantity !== undefined) {
      const quantity = parseInt(updateData.quantity);
      if (isNaN(quantity) || quantity < 0) {
        await cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: "Invalid quantity value",
        });
      }
      updateData.quantity = quantity;
    }

    // finalImages will hold URLs (existing retained URLs + newly uploaded URLs)
    let finalImages = [];

    // retainedImageHashes previously held base64; accept retainedImageUrls now
    if (req.body.retainedImageUrls) {
      try {
        const retainedUrls = JSON.parse(req.body.retainedImageUrls);
        if (Array.isArray(retainedUrls)) {
          retainedUrls.forEach((u) => {
            if (typeof u === "string" && u.trim().length > 0) {
              finalImages.push(u);
            }
          });
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (req.files && req.files.length > 0) {
      if (finalImageBuffers.length + req.files.length > 4) {
        await cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: "Cannot have more than 4 product images",
        });
      }

      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      const maxFileSize = 5 * 1024 * 1024;

      for (const file of req.files) {
        if (!allowedTypes.includes(file.mimetype)) {
          await cleanupFiles(req.files);
          return res.status(400).json({
            success: false,
            message: "Invalid file type. Allowed types: JPG, PNG, WEBP",
          });
        }

        if (file.size > maxFileSize) {
          await cleanupFiles(req.files);
          return res.status(400).json({
            success: false,
            message: "File is too large. Maximum size is 5MB",
          });
        }

        try {
          const buffer = await fileToBuffer(file);

            if (isValidBuffer(buffer)) {
            const processed = await sharp(buffer)
              .webp({ lossless: true, effort: 4 })
              .toBuffer();

            // upload processed image to ImageKit (guarded)
            try {
              const uploadResult = await uploadToImageKit({
                file: processed,
                fileName: `${Date.now()}_${file.originalname}.webp`,
                useUniqueFileName: true,
              });

              if (uploadResult && uploadResult.url) {
                finalImages.push(uploadResult.url);
              }
            } catch (uploadErr) {
              console.error('ImageKit upload error:', uploadErr);
            }
          } else {
            console.warn(
              `Skipped invalid or too small buffer for file: ${file.originalname}`
            );
          }
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
        }
      }
    }

    if (finalImages.length === 0) {
      await cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    updateData.productImages = finalImages;

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    await cleanupFiles(req.files);

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
      imageUpdateSummary: {
        totalImages: finalImages.length,
        newImagesAdded: req.files?.length || 0,
        existingImagesRetained:
          finalImages.length - (req.files?.length || 0),
      },
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    await cleanupFiles(req.files);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the product",
    });
  }
};
