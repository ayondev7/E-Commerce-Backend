const Product = require("../models/Product");
const { body, validationResult } = require("express-validator");
const sharp = require("sharp");

exports.createProduct = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("brand").trim().notEmpty().withMessage("Brand is required"),
  body("model").trim().notEmpty().withMessage("Model is required"),
  body("storage").trim().notEmpty().withMessage("Storage is required"),
  body("colour").trim().notEmpty().withMessage("Colour is required"),
  body("ram").trim().notEmpty().withMessage("RAM is required"),
  body("conditions").custom((value) => {
    if (!value) throw new Error("Conditions are required");
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("At least one condition is required");
    }
    return true;
  }),
  body("features").custom((value) => {
    if (!value) throw new Error("Features are required");
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("At least one feature is required");
    }
    return true;
  }),
  body("price").isNumeric().withMessage("Price must be a number"),
  body("salePrice")
    .optional()
    .isNumeric()
    .withMessage("Sale price must be a number"),
  body("quantity")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),
  body("sku")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("SKU cannot be empty if provided"),
  body("negotiable")
    .optional()
    .isBoolean()
    .withMessage("Negotiable must be a boolean"),
  body("tags")
    .optional()
    .custom((value) => {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!Array.isArray(parsed)) {
        throw new Error("Tags must be an array");
      }
      return true;
    }),
  body("specifications")
    .optional()
    .custom((value) => {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!Array.isArray(parsed)) {
        throw new Error("Specifications must be an array");
      }
      for (const spec of parsed) {
        if (!spec.label || !spec.value) {
          throw new Error("Each specification must have both label and value");
        }
      }
      return true;
    }),

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
      return res.status(400).json({ error: "At least one product image is required" });
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
          productImages.push(processed);
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

exports.getAllProducts = async (req, res) => {
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
        image: product.productImages?.[0]?.length
          ? product.productImages[0].toString("base64")
          : null,
      };
    });

    res.status(200).json({ products: formattedProducts });
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllProductsById = async (req, res) => {
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
        image: dbProduct.productImages?.[0]
          ? dbProduct.productImages[0].toString("base64")
          : null,
      };
    });

    res.status(200).json({ products: formattedProducts });
  } catch (error) {
    console.error("Get products by ID(s) error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.searchProducts = async (req, res) => {
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
      image:
        product.productImages?.[0]?.length > 0
          ? product.productImages[0].toString("base64")
          : null,
    }));

    res.status(200).json({ products: formattedProducts });
  } catch (error) {
    console.error("Product search error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.seller?._id;

    if (!sellerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const product = await Product.findOne({
      _id: id,
      sellerId,
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const productObj = product.toObject();

    
    productObj.productImages = productObj.productImages.map((img) =>
      img ? img.toString('base64') : null
    );

    
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
    console.error('Error fetching product:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteProduct = async (req, res) => {
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
      return res.status(404).json({ error: "Product not found or not authorized" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getProductsByCategory = async (req, res) => {
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
        productImages: productObj.productImages.map((img) =>
          img.toString("base64")
        ),
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

exports.getProductStats = async (req, res) => {
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

exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const updateData = { ...req.body };

    delete updateData.productId;

    delete updateData.productImages;

    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }

    if (updateData.salePrice !== undefined) {
      updateData.salePrice = parseFloat(updateData.salePrice);
    }

    if (updateData.quantity !== undefined) {
      updateData.quantity = parseInt(updateData.quantity);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the product',
    });
  }
};

