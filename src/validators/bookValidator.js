const { CATEGORIES } = require('../utils/constants');

/**
 * Validate book upload (supports both PDF and images)
 * @param {string} title - Book title
 * @param {string} category - Optional category (AI detects if not provided)
 * @param {Object} file - Optional file object from multer
 * @returns {Object} - Validation result with errors
 */

const validateBookUpload = (title, category, file = null) => {
  const errors = {};

  // Validate title
  if (!title || title.trim().length < 2) {
    errors.title = 'Book title must be at least 2 characters';
  }

  if (title && title.trim().length > 100) {
    errors.title = 'Book title must be less than 100 characters';
  }

  // Validate file if provided
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

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      errors.file = 'File size must be less than 50MB';
    }
  }

  // Category is optional during upload - AI will detect it
  // Only validate category if it's provided
  if (category && !CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${CATEGORIES.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate image-only upload
 * @param {string} title - Image title
 * @param {Object} file - File object from multer
 * @param {string} category - Optional category
 * @returns {Object} - Validation result with errors
 */
const validateImageUpload = (title, file, category = null) => {
  const errors = {};

  // Validate title
  if (!title || title.trim().length < 2) {
    errors.title = 'Image title must be at least 2 characters';
  }

  if (title && title.trim().length > 100) {
    errors.title = 'Image title must be less than 100 characters';
  }

  // Validate file exists
  if (!file) {
    errors.file = 'Image file is required';
  } else {
    // Validate it's an image
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

    // Validate file size (max 20MB for images)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      errors.file = 'Image size must be less than 20MB';
    }
  }

  // Category is optional
  if (category && !CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${CATEGORIES.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate book ID format
 * @param {string} bookId - MongoDB ObjectId
 * @returns {Object} - Validation result with errors
 */
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
