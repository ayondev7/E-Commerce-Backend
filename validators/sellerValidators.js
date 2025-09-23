const { body } = require('express-validator');

const createSellerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
];

const loginSellerValidators = [
  body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
];

module.exports = {
  createSellerValidators,
  loginSellerValidators,
};
