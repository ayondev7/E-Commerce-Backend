import express from 'express';

const router = express.Router();

const routes = [
  { path: '/sellers', module: './sellerRoutes' },
  { path: '/products', module: './productRoutes' },
  { path: '/customers', module: './customerRoutes' },
  { path: '/carts', module: './cartRoutes' },
  { path: '/wishlists', module: './wishlistRoutes' },
  { path: '/addresses', module: './AddressRoutes' },
  { path: '/orders', module: './orderRoutes' },
  { path: '/auth', module: './authCheckRoute' },
  { path: '/payment', module: './paymentRoutes' },
];

(async () => {
  for (const { path: routePath, module } of routes) {
    const mod = await import(module + '.js');
    const r = mod.default || mod.router || mod;
    router.use(routePath, r);
  }
})();

export default router;
