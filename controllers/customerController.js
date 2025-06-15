const Customer = require("../models/Customer");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");

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
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const customer = await Customer.findOne({ email }).select("+password");
      if (!customer) return res.status(401).json({ error: "Invalid credentials" });

      const isMatch = await bcrypt.compare(password, customer.password);
      if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { customerId: customer._id },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
      );

      const { password: _, customerImage, ...customerData } = customer.toObject();

      res.status(200).json({
        token,
        customer: {
          ...customerData,
          customerImage: customerImage ? customerImage.toString("base64") : null
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
];

exports.getCustomerProfile = async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId).select("-password");
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
      req.customerId,
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
