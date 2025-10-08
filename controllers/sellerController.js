import Seller from '../models/Seller.js';
import * as sellerService from '../services/sellerServices.js';
import { validationResult } from 'express-validator';
import { createSellerValidators, loginSellerValidators } from '../validators/sellerValidators.js';
import { generateToken, comparePassword } from '../utils/authUtils.js';

export const createSeller = [
  ...createSellerValidators,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Seller image is required' });
      }

      const existingSeller = await sellerService.findSellerByEmail(email);
      if (existingSeller) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      const seller = await sellerService.createSeller(req.body, req.file);
      const accessToken = generateToken({ sellerId: seller._id });

      res.status(201).json({
        accessToken,
        sellerId: seller._id,
      });
    } catch (error) {
      if (error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Server error', details: (error && error.message) || null });
    }
  },
];

export const loginSeller = [
  ...loginSellerValidators,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const seller = await Seller.findOne({ email }).select('+password');
      if (!seller) {
        return res.status(401).json({ error: 'Invalid email' });
      }

      const isPasswordValid = await comparePassword(password, seller.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const accessToken = generateToken({ sellerId: seller._id });
      const sellerData = sellerService.formatSellerData(seller);

      res.status(200).json({
        accessToken,
        seller: sellerData,
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  },
];

export const getAllSellers = async (req, res) => {
  try {
    const sellers = await Seller.find().select('-password');

    const sellersWithImages = sellers.map((seller) => {
      const { sellerImage, ...sellerData } = seller.toObject();
      return {
        ...sellerData,
        sellerImage: sellerImage || null,
      };
    });

    res.status(200).json(sellersWithImages);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const getSellerProfile = async (req, res) => {
  try {
    const { seller } = req;

    if (!seller || !seller._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not found in request',
      });
    }

    const foundSeller = await sellerService.findSellerById(seller._id);

    if (!foundSeller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: sellerService.formatSellerProfile(foundSeller),
    });
  } catch (error) {
    console.error('Error fetching seller profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching seller profile',
    });
  }
};

export const getSellerNotifications = async (req, res) => {
  const sellerId = req.seller?._id;

  if (!sellerId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const notifications = await sellerService.getSellerNotifications(sellerId);
  res.status(200).json({ success: true, notifications });
};

export const updateLastNotificationSeen = async (req, res) => {
  const sellerId = req.seller?._id;
  const { lastSeenNotificationId } = req.body;

  if (!sellerId || !lastSeenNotificationId) {
    return res.status(400).json({
      success: false,
      message: 'Missing seller ID or notification ID',
    });
  }

  await sellerService.updateLastNotificationSeen(sellerId, lastSeenNotificationId);

  res.status(200).json({
    success: true,
    message: 'Last seen notification updated successfully',
  });
};

export const getSellerPayments = async (req, res) => {
  try {
    const { seller } = req;
    const sellerId = seller?._id;

    if (!sellerId) {
      return res.status(400).json({ message: 'Seller ID is required' });
    }

    const payments = await sellerService.getSellerPayments(sellerId);
    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error('Error fetching seller payments:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const guestSellerLogin = async (req, res) => {
  try {
    const guestEmail = process.env.GUEST_SELLER_EMAIL;
    const guestPassword = process.env.GUEST_PASSWORD;

    if (!guestEmail || !guestPassword) {
      return res.status(500).json({ error: 'Guest credentials are not configured' });
    }

    const seller = await Seller.findOne({ email: guestEmail }).select('+password');
    if (!seller) {
      return res.status(404).json({ error: 'Guest seller not found' });
    }

    const isMatch = await comparePassword(guestPassword, seller.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Guest authentication failed' });
    }

    const accessToken = generateToken({ sellerId: seller._id });
    const sellerData = sellerService.formatSellerData(seller);

    return res.status(200).json({ accessToken, seller: sellerData });
  } catch (error) {
    console.error('Guest seller login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
