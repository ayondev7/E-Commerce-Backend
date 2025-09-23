import { body } from 'express-validator';

export const createSellerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
];

export const loginSellerValidators = [
  body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
];

