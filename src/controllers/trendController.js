const Book = require('../models/Book');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Get trending books (most saved)
// @route   GET /api/trending/books
// @access  Private
const getTrendingBooks = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const books = await Book.find()
      .populate('lecturerId', 'name')
      .sort({ saveCount: -1, createdAt: -1 })
      .limit(parseInt(limit));

    return successResponse(res, books, 'Trending books fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  getTrendingBooks,
};