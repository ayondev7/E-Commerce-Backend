import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();

// Restrict CORS to only allow the configured FRONTEND_URL
const allowedOrigin = process.env.FRONTEND_URL;
app.use((req, res, next) => {
  const origin = req.get('Origin');

  // Allow non-browser same-origin requests (no Origin header)
  if (!origin) return next();

  if (allowedOrigin && origin === allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    // Handle preflight
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }

  // Block disallowed origins
  res.status(403).json({ error: 'CORS policy: This origin is not allowed' });
});
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use('/uploads', express.static(join(__dirname, 'uploads')));

const routes = [
  { path: "/api/sellers", module: "./routes/sellerRoutes" },
  { path: "/api/products", module: "./routes/productRoutes" },
  { path: "/api/customers", module: "./routes/customerRoutes" },
  { path: "/api/carts", module: "./routes/cartRoutes" },
  { path: "/api/wishlists", module: "./routes/wishlistRoutes" },
  { path: "/api/addresses", module: "./routes/AddressRoutes" },
  { path: "/api/orders", module: "./routes/orderRoutes" },
  { path: "/api/auth", module: "./routes/authCheckRoute" },
  { path: "/api/payment", module: "./routes/paymentRoutes" },
];

(async () => {
  for (const { path: routePath, module } of routes) {
    const mod = await import(module + '.js');
    // many route files export the router as default or module.exports = router
    const router = mod.default || mod.router || mod;
    app.use(routePath, router);
  }
})();

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong!" });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
