const { CATEGORIES } = require('../utils/constants');

const validateBookUpload = (title, category) => {
  const errors = {};

  if (!title || title.trim().length < 2) {
    errors.title = 'Book title must be at least 2 characters';
  }

  if (!category) {
    errors.category = 'Category is required';
  } else if (!CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${CATEGORIES.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateBookId = (bookId) => {
  const errors = {};
  
  if (!bookId) {
    errors.bookId = 'Book ID is required';
  } else if (!/^[0-9a-fA-F]{24}$/.test(bookId)) {
    errors.bookId = 'Invalid book ID format';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = {
  validateBookUpload,
  validateBookId,
};