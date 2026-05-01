const Save = require('../models/Save');
const Book = require('../models/Book');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Save a book
// @route   POST /api/saves/:bookId
// @access  Student only
const saveBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const studentId = req.user._id;

    const book = await Book.findById(bookId);
    if (!book) {
      return errorResponse(res, 'Book not found', 404);
    }

    const existingSave = await Save.findOne({ studentId, bookId });
    if (existingSave) {
      return errorResponse(res, 'Book already saved', 400);
    }

    await Save.create({ studentId, bookId });
    
    // Increment save count on book
    await Book.findByIdAndUpdate(bookId, { $inc: { saveCount: 1 } });

    return successResponse(res, { saved: true }, 'Book saved successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Unsave a book
// @route   DELETE /api/saves/:bookId
// @access  Student only
const unsaveBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const studentId = req.user._id;

    const result = await Save.findOneAndDelete({ studentId, bookId });
    
    if (!result) {
      return errorResponse(res, 'Book not found in saved list', 404);
    }

    // Decrement save count on book
    await Book.findByIdAndUpdate(bookId, { $inc: { saveCount: -1 } });

    return successResponse(res, { saved: false }, 'Book unsaved successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Check if book is saved
// @route   GET /api/saves/check/:bookId
// @access  Student only
const checkSaved = async (req, res) => {
  try {
    const { bookId } = req.params;
    const studentId = req.user._id;

    const save = await Save.findOne({ studentId, bookId });
    
    return successResponse(res, { isSaved: !!save }, 'Check completed');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get all saved books for current student
// @route   GET /api/saves
// @access  Student only
const getSavedBooks = async (req, res) => {
  try {
    const saves = await Save.find({ studentId: req.user._id })
      .populate({
        path: 'bookId',
        populate: [
          { path: 'lecturerId', select: 'name profilePicture specialty institution' }
        ]
      })
      .sort({ createdAt: -1 });

    const books = saves.map(save => save.bookId);

    return successResponse(res, books, 'Saved books fetched successfully');
  } catch (error) {
    console.error('Get saved books error:', error);
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  saveBook,
  unsaveBook,
  checkSaved,
  getSavedBooks,
};
