export function parseArrayField(field) {
  if (!field) return [];
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [field];
    }
  }
  return Array.isArray(field) ? field : [field];
}

export function validatePrice(price) {
  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    return { valid: false, error: 'Invalid price value' };
  }
  return { valid: true, value: parsedPrice };
}

export function validateQuantity(quantity) {
  const parsedQuantity = parseInt(quantity);
  if (isNaN(parsedQuantity) || parsedQuantity < 0) {
    return { valid: false, error: 'Invalid quantity value' };
  }
  return { valid: true, value: parsedQuantity };
}

export function validateFileType(file, allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']) {
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` };
  }
  return { valid: true };
}

export function validateFileSize(file, maxSize = 5 * 1024 * 1024) {
  if (file.size > maxSize) {
    return { valid: false, error: `File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB` };
  }
  return { valid: true };
}

export function validateImageFiles(files, maxCount = 4) {
  if (!files || files.length === 0) {
    return { valid: false, error: 'At least one image is required' };
  }

  if (files.length > maxCount) {
    return { valid: false, error: `Maximum ${maxCount} images allowed` };
  }

  for (const file of files) {
    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) return typeValidation;

    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) return sizeValidation;
  }

  return { valid: true };
}
