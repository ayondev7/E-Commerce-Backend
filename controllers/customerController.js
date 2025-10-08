import Customer from '../models/Customer.js';
import * as customerService from '../services/customerServices.js';
import { validationResult } from 'express-validator';
import { createCustomerValidators, loginCustomerValidators } from '../validators/customerValidators.js';
import { generateToken, comparePassword } from '../utils/authUtils.js';

export const createCustomer = [
  ...createCustomerValidators,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email } = req.body;
      const existingCustomer = await customerService.findCustomerByEmail(email);
      if (existingCustomer) return res.status(400).json({ error: 'Email already exists' });

      const customer = await customerService.createCustomer(req.body, req.file);

      const token = generateToken({ customerId: customer._id });

      res.status(201).json({
        token,
        customerId: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
];

export const loginCustomer = [
  ...loginCustomerValidators,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const customer = await Customer.findOne({ email }).select('+password');
      if (!customer) {
        return res.status(401).json({ error: 'Incorrect Email! Please try again.' });
      }

      const isMatch = await comparePassword(password, customer.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect Password! Please try again.' });
      }

      const token = generateToken({ customerId: customer._id });

      const customerObj = customer.toObject();
      delete customerObj.password;
      delete customerObj.customerImage;

      return res.status(200).json({
        accessToken: token,
        customer: customerObj,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  }
];
export const getCustomerProfileInfo = async (req, res) => {
  try {
    const customer = await customerService.findCustomerById(req.customer._id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const responseData = customerService.formatCustomerProfileInfo(customer.toObject());
    return res.status(200).json(responseData);
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to fetch profile',
      details: error.message 
    });
  }
};

export const getCustomerProfile = async (req, res) => {
  try {
    const { customer } = req;

    if (!customer || !customer._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Customer not found in request',
      });
    }

    const foundCustomer = await customerService.findCustomerById(customer._id);

    if (!foundCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: customerService.formatCustomerProfile(foundCustomer),
    });
  } catch (error) {
    console.error('Error fetching customer profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching customer profile',
    });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const customer = await customerService.updateCustomerProfile(req.customer._id, req.body, req.file);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const responseData = customerService.formatCustomerProfileInfo(customer.toObject());
    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().select('-password');

    const customersWithImages = customers.map((customer) =>
      customerService.formatCustomerProfileInfo(customer.toObject())
    );

    res.status(200).json(customersWithImages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCustomerStats = async (req, res) => {
  try {
    const stats = await customerService.getCustomerStats(req.customer._id);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getActivitiesByCustomer = async (req, res) => {
  try {
    const { customer } = req;
    const customerId = customer?._id;

    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }

    const activities = await customerService.getCustomerActivities(customerId);
    res.status(200).json({ success: true, activities });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getAllNotifications = async (req, res) => {
  try {
    const { customer } = req;
    const customerId = customer?._id;

    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }

    const notifications = await customerService.getCustomerNotifications(customerId);
    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const markNotificationsAsSeen = async (req, res) => {
  try {
    const { customer } = req;
    const { notificationId } = req.body;

    if (!customer || !customer._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!notificationId) {
      return res.status(400).json({ success: false, message: 'Notification ID is required' });
    }

    await customerService.markNotificationsAsSeen(customer._id, notificationId);
    res.status(200).json({ success: true, message: 'Notifications marked as seen.' });
  } catch (error) {
    console.error('Error updating lastNotificationSeen:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const guestCustomerLogin = async (req, res) => {
  try {
    const guestEmail = process.env.GUEST_CUSTOMER_EMAIL;
    const guestPassword = process.env.GUEST_PASSWORD;

    if (!guestEmail || !guestPassword) {
      return res.status(500).json({ error: 'Guest credentials are not configured' });
    }

    const customer = await Customer.findOne({ email: guestEmail }).select('+password');
    if (!customer) {
      return res.status(404).json({ error: 'Guest customer not found' });
    }

    const isMatch = await comparePassword(guestPassword, customer.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Guest authentication failed' });
    }

    const token = generateToken({ customerId: customer._id });

    const customerObj = customer.toObject();
    delete customerObj.password;
    delete customerObj.customerImage;

    return res.status(200).json({ accessToken: token, customer: customerObj });
  } catch (error) {
    console.error('Guest login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
