const { body } = require('express-validator');

const createCustomerValidators = [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').trim().isLength({ min: 6 }),
  body('phone').optional().trim(),
];

const loginCustomerValidators = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

module.exports = {
  createCustomerValidators,
  loginCustomerValidators,
};
