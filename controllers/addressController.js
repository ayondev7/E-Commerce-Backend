const Address = require('../models/Address');
const mongoose = require('mongoose');

exports.addAddress = async (req, res) => {
  try {
    const { addressLine, city, zipCode, country, state, isDefault, name } = req.body;

    if (isDefault) {
      await Address.updateMany(
        { customerId: req.customer._id, isDefault: true },
        { isDefault: false }
      );
    }

    const address = await Address.create({
      customerId: req.customer._id,
      addressLine,
      city,
      zipCode,
      country,
      state,
      name: name?.trim() || "Unnamed",
      isDefault: !!isDefault
    });

    res.status(201).json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ customerId: req.customer._id }).sort({ isDefault: -1 });
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const updates = req.body;

    const address = await Address.findOneAndUpdate(
      { _id: addressId, customerId: req.customer._id },
      updates,
      { new: true }
    );

    if (!address) return res.status(404).json({ error: 'Address not found' });

    res.status(200).json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;

    const result = await Address.findOneAndDelete({
      _id: addressId,
      customerId: req.customer._id
    });

    if (!result) return res.status(404).json({ error: 'Address not found' });

    res.status(200).json({ message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    await Address.updateMany(
      { customerId: req.customer._id },
      { isDefault: false }
    );

    const updated = await Address.findOneAndUpdate(
      { _id: addressId, customerId: req.customer._id },
      { isDefault: true },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Address not found' });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
