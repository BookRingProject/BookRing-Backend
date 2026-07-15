const { CATEGORIES } = require('../utils/constants');

const validateBookUpload = (title, category, file = null) => {
  const errors = {};

  if (!title || title.trim().length < 2) {
    errors.title = 'Book title must be at least 2 characters';
  }

  if (title && title.trim().length > 100) {
    errors.title = 'Book title must be less than 100 characters';
  }

  if (file) {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/bmp',
      'image/gif'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      errors.file = 'File must be a PDF or image (JPEG, PNG, WebP, BMP, GIF)';
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.file = 'File size must be less than 50MB';
    }
  }

  if (category && !CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${CATEGORIES.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateImageUpload = (title, file, category = null) => {
  const errors = {};

  if (!title || title.trim().length < 2) {
    errors.title = 'Image title must be at least 2 characters';
  }

  if (title && title.trim().length > 100) {
    errors.title = 'Image title must be less than 100 characters';
  }

  if (!file) {
    errors.file = 'Image file is required';
  } else {
    const imageMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/bmp',
      'image/gif'
    ];

    if (!imageMimeTypes.includes(file.mimetype)) {
      errors.file = 'File must be an image (JPEG, PNG, WebP, BMP, GIF)';
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.file = 'Image size must be less than 20MB';
    }
  }

  if (category && !CATEGORIES.includes(category)) {
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
  validateImageUpload,
  validateBookId,
};
