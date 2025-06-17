require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const routes = [
  { path: '/api/sellers', module: './routes/sellerRoutes' },
  { path: '/api/products', module: './routes/productRoutes' },
  { path: '/api/customers', module: './routes/customerRoutes' },
  { path: '/api/carts', module: './routes/cartRoutes' },
  { path: '/api/wishlists', module: './routes/wishlistRoutes' },
  { path: '/api/addresses', module: './routes/AddressRoutes' },
  { path: '/api/orders', module: './routes/orderRoutes' },
  { path: '/api/auth', module: './routes/authCheckRoute' },
];

routes.forEach(({ path, module }) => {
  app.use(path, require(module));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
