import * as addressService from '../services/addressServices.js';

export const addAddress = async (req, res) => {
  try {
    const address = await addressService.createAddress(req.customer._id, req.body);
    res.status(201).json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllAddresses = async (req, res) => {
  try {
    const addresses = await addressService.getAddressesByCustomer(req.customer._id);
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const address = await addressService.updateAddressById(req.params.id, req.customer._id, req.body);
    if (!address) return res.status(404).json({ error: 'Address not found' });
    res.status(200).json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const result = await addressService.deleteAddressById(req.params.id, req.customer._id);
    if (!result) return res.status(404).json({ error: 'Address not found' });
    res.status(200).json({ message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const updated = await addressService.setAddressAsDefault(req.params.id, req.customer._id);
    if (!updated) return res.status(404).json({ error: 'Address not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
