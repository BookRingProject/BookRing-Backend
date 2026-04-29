const Book = require('../models/Book');
const { CATEGORIES } = require('../utils/constants');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
const getAllCategories = async (req, res) => {
  try {
    return successResponse(res, CATEGORIES, 'Categories fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get books by category
// @route   GET /api/categories/:category/books
// @access  Private
const getBooksByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!CATEGORIES.includes(category)) {
      return errorResponse(res, 'Invalid category', 400);
    }

    const books = await Book.find({ category })
      .populate('lecturerId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Book.countDocuments({ category });

    return successResponse(res, {
      books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    }, 'Books fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  getAllCategories,
  getBooksByCategory,
};