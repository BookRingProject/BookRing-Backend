const Book = require('../models/Book');
const Save = require('../models/Save');
const Download = require('../models/Download');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Get student's library (saved books)
// @route   GET /api/students/library
// @access  Student only
const getLibrary = async (req, res) => {
  try {
    const saves = await Save.find({ studentId: req.user._id })
      .populate({
        path: 'bookId',
        populate: { path: 'lecturerId', select: 'name' }
      })
      .sort({ createdAt: -1 });

    const books = saves.map(save => save.bookId);

    return successResponse(res, books, 'Library fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get student's saved books (IDs only)
// @route   GET /api/students/saved-books
// @access  Student only
const getSavedBookIds = async (req, res) => {
  try {
    const saves = await Save.find({ studentId: req.user._id }).select('bookId');
    const bookIds = saves.map(save => save.bookId);

    return successResponse(res, bookIds, 'Saved book IDs fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Record a download
// @route   POST /api/students/downloads
// @access  Student only
const recordDownload = async (req, res) => {
  try {
    const { bookId, type } = req.body;

    if (!bookId || !type) {
      return errorResponse(res, 'Book ID and type are required', 400);
    }

    if (!['pdf', 'summary', 'audio'].includes(type)) {
      return errorResponse(res, 'Invalid download type', 400);
    }

    await Download.create({
      userId: req.user._id,
      bookId,
      type,
    });

    return successResponse(res, null, 'Download recorded successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  getLibrary,
  getSavedBookIds,
  recordDownload,
};