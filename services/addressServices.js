import Address from '../models/Address.js';

export async function createAddress(customerId, addressData) {
  const { addressLine, city, zipCode, country, state, isDefault, name } = addressData;

  if (isDefault) {
    await clearDefaultAddresses(customerId);
  }

  return await Address.create({
    customerId,
    addressLine,
    city,
    zipCode,
    country,
    state,
    name: name?.trim() || 'Unnamed',
    isDefault: !!isDefault
  });
}

export async function clearDefaultAddresses(customerId) {
  await Address.updateMany(
    { customerId, isDefault: true },
    { isDefault: false }
  );
}

export async function getAddressesByCustomer(customerId) {
  return await Address.find({ customerId }).sort({ isDefault: -1 });
}

export async function updateAddressById(addressId, customerId, updates) {
  return await Address.findOneAndUpdate(
    { _id: addressId, customerId },
    updates,
    { new: true }
  );
}

export async function deleteAddressById(addressId, customerId) {
  return await Address.findOneAndDelete({
    _id: addressId,
    customerId
  });
}

export async function setAddressAsDefault(addressId, customerId) {
  await clearDefaultAddresses(customerId);

  return await Address.findOneAndUpdate(
    { _id: addressId, customerId },
    { isDefault: true },
    { new: true }
  );
}

export async function findAddressById(addressId) {
  return await Address.findById(addressId);
}
