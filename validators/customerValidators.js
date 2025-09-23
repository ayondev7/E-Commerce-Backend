import { body } from 'express-validator';

export const createCustomerValidators = [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').trim().isLength({ min: 6 }),
  body('phone').optional().trim(),
];

export const loginCustomerValidators = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

