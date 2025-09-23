import express from 'express';
const router = express.Router();
import * as productController from '../controllers/productController.js';
import auth from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    fieldSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  },
});

router.post(
  "/create",
  auth,
  upload.array("productImages", 4),
  productController.createProduct
);

router.get("/get-all", auth, productController.getAllProducts);
router.get("/shop/get-all", productController.getAllProductsForShop);
router.get("/shop/get-product/:id", productController.getProductDetails);

router.post("/get-all-by-id", auth, productController.getAllProductsById);

router.get("/search", auth, productController.searchProducts);

router.get("/get-product/:id", auth, productController.getSingleProduct);

router.patch(
  "/update-product",
  auth,
  upload.array("productImages", 4),
  productController.updateProduct
);

router.delete("/delete/:id", auth, productController.deleteProduct);

export default router;
