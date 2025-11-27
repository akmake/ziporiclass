import { body, validationResult } from 'express-validator';
import AppError from './AppError.js';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map(err => err.msg).join('. ');
    return next(new AppError(message, 400));
  }
  next();
};

export const registerValidator = [
  body('email').isEmail().withMessage('Please provide a valid email address.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  handleValidationErrors,
];

export const loginValidator = [
  body('email').isEmail().withMessage('Please provide a valid email.'),
  body('password').notEmpty().withMessage('Password is required.'),
  handleValidationErrors,
];

export const productValidator = [
  body('name').notEmpty().withMessage('Product name is required.'),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be a positive number.'),
  body('description').notEmpty().withMessage('Description is required.'),
  body('category').isIn(['main', 'side', 'dessert', 'drink']).withMessage('Invalid category.'),
  handleValidationErrors,
];

export { handleValidationErrors };