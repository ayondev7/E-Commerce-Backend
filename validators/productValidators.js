import { body } from 'express-validator';

export const baseProductValidators = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('storage').trim().notEmpty().withMessage('Storage is required'),
  body('colour').trim().notEmpty().withMessage('Colour is required'),
  body('ram').trim().notEmpty().withMessage('RAM is required'),
  body('conditions').custom((value) => {
    if (!value) throw new Error('Conditions are required');
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('At least one condition is required');
    }
    return true;
  }),
  body('features').custom((value) => {
    if (!value) throw new Error('Features are required');
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('At least one feature is required');
    }
    return true;
  }),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('salePrice').optional().isNumeric().withMessage('Sale price must be a number'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('sku').optional().trim().notEmpty().withMessage('SKU cannot be empty if provided'),
  body('negotiable').optional().isBoolean().withMessage('Negotiable must be a boolean'),
  body('tags').optional().custom((value) => {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
      throw new Error('Tags must be an array');
    }
    return true;
  }),
  body('specifications').optional().custom((value) => {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
      throw new Error('Specifications must be an array');
    }
    for (const spec of parsed) {
      if (!spec.label || !spec.value) {
        throw new Error('Each specification must have both label and value');
      }
    }
    return true;
  }),
];

