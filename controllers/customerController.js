const Customer = require("../models/Customer");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const Order = require("../models/Order");
const Wishlist = require("../models/Wishlist");
const RecentActivity = require("../models/RecentActivity");

const buildCustomerPayload = async ({ firstName, lastName, email, password, phone, bio }, file) => {
  const customerImage = file
    ? await sharp(file.buffer).webp({ lossless: true, effort: 4 }).toBuffer()
    : undefined;

  const hashedPassword = await bcrypt.hash(password, 12);

  return {
    firstName,
    lastName,
    email,
    password: hashedPassword,
    phone,
    lastNotificationSeen,
    bio,
    ...(customerImage && { customerImage })
  };
};

exports.createCustomer = [
  body("firstName").trim().notEmpty(),
  body("lastName").trim().notEmpty(),
  body("email").trim().isEmail().normalizeEmail(),
  body("password").trim().isLength({ min: 6 }),
  body("phone").optional().trim(),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email } = req.body;
      const existingCustomer = await Customer.findOne({ email });
      if (existingCustomer) return res.status(400).json({ error: "Email already exists" });

      const customerData = await buildCustomerPayload(req.body, req.file);
      const customer = new Customer(customerData);
      await customer.save();

      const token = jwt.sign(
        { customerId: customer._id },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
      );

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

exports.loginCustomer = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const customer = await Customer.findOne({ email }).select("+password");
      if (!customer) {
        return res.status(401).json({ error: "Incorrect Email! Please try again." });
      }

      const isMatch = await bcrypt.compare(password, customer.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Incorrect Password! Please try again." });
      }

      const token = jwt.sign(
        { customerId: customer._id },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
      );

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

exports.getCustomerProfileInfo = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer._id)
      .select('-password -__v')
      .lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { customerImage, ...profile } = customer;

    const responseData = {
      ...profile,
      customerImage: customerImage?.toString('base64') || null
    };

    return res.status(200).json(responseData);

  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to fetch profile',
      details: error.message 
    });
  }
};

exports.getCustomerProfile = async (req, res) => {
  try {
    const { customer } = req;

    if (!customer || !customer._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Customer not found in request",
      });
    }

    const foundCustomer = await Customer.findById(customer._id);

    if (!foundCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const { password, customerImage, firstName, lastName, ...rest } = foundCustomer.toObject();

    return res.status(200).json({
      success: true,
      data: {
        ...rest,
        name: `${firstName} ${lastName}`,
        image: customerImage ? customerImage.toString('base64') : null,
      },
    });

  } catch (error) {
    console.error("Error fetching customer profile:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching customer profile",
    });
  }
};


exports.updateCustomer = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (req.file) {
      updates.customerImage = await sharp(req.file.buffer)
        .webp({ lossless: true, effort: 4 })
        .toBuffer();
    }

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }

    const customer = await Customer.findByIdAndUpdate(
      req.customer._id,
      updates,
      { new: true }
    ).select("-password");

    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const { customerImage, ...customerData } = customer.toObject();

    res.status(200).json({
      ...customerData,
      customerImage: customerImage ? customerImage.toString("base64") : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().select("-password");

    const customersWithImages = customers.map((customer) => {
      const { customerImage, ...customerData } = customer.toObject();
      return {
        ...customerData,
        customerImage: customerImage ? customerImage.toString("base64") : null
      };
    });

    res.status(200).json(customersWithImages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCustomerStats = async (req, res) => {
  try {
    const { customer } = req;
    const { _id: customerId } = customer;
    const totalOrders = await Order.countDocuments({ customerId });
    const pendingOrders = await Order.countDocuments({
      customerId,
      orderStatus: 'pending',
    });
    
    const wishlists = await Wishlist.find({ customerId }, 'productIds');
    const totalWishlistItems = wishlists.reduce(
      (total, wl) => total + (wl.productIds?.length || 0),
      0
    );

    res.status(200).json({
      totalOrders,
      pendingOrders,
      totalWishlistItems,
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getActivitiesByCustomer = async (req, res) => {
  try {
    const { customer } = req;
    const customerId = customer?._id;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const activities = await RecentActivity.find({ customerId }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, activities });
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const { customer } = req;
    const customerId = customer?._id;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const customerDoc = await Customer.findById(customerId).select("lastNotificationSeen");
    const lastSeenId = customerDoc?.lastNotificationSeen;

    const activities = await RecentActivity.find({ customerId }).sort({ createdAt: -1 });

    const processedActivities = activities.map((activity) => ({
      ...activity.toObject(),
      isNew: !lastSeenId || activity._id.toString() > lastSeenId.toString(),
    }));

    res.status(200).json({ success: true, notifications: processedActivities });
  } catch (error) {
    console.error("Error fetching all notifications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markNotificationsAsSeen = async (req, res) => {
  try {
    const { customer } = req;
    const { notificationId } = req.body;

    if (!customer || !customer._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!notificationId) {
      return res.status(400).json({ success: false, message: "Notification ID is required" });
    }

    await Customer.findByIdAndUpdate(customer._id, {
      lastNotificationSeen: notificationId,
    });

    res.status(200).json({ success: true, message: "Notifications marked as seen." });
  } catch (error) {
    console.error("Error updating lastNotificationSeen:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
