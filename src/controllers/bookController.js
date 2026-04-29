const Book = require('../models/Book');
const User = require('../models/User');
const Save = require('../models/Save');
const View = require('../models/View');
const { validateBookUpload } = require('../validators/bookValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { uploadPDF, uploadAudio, uploadImage } = require('../services/uploadService');
const { summarizePDF, detectCategory } = require('../services/aiService');
const { convertToAudio } = require('../services/ttsService');
const { extractCoverImage } = require('../services/pdfService');
const { cleanupTempFile } = require('../services/storageService');
const fs = require('fs');

// @desc    Upload a new book
// @route   POST /api/books/upload
// @access  Lecturer only
const uploadBook = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload a PDF file', 400);
    }

    const { title } = req.body;
    const lecturerId = req.user._id;

    const validation = validateBookUpload(title, null);
    if (!validation.isValid) {
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    const pdfPath = req.file.path;

    // Extract cover image from PDF
    const coverImagePath = await extractCoverImage(pdfPath);
    
    // Upload PDF to Cloudinary
    const pdfUrl = await uploadPDF(pdfPath, title);
    
    // Upload cover image to Cloudinary
    let coverUrl = '';
    if (coverImagePath) {
      coverUrl = await uploadImage(coverImagePath, `covers/${title}`);
      cleanupTempFile(coverImagePath);
    }

    // Detect category using AI
    const category = await detectCategory(pdfPath);

    // Summarize PDF using AI
    const summaryText = await summarizePDF(pdfPath);

    // Convert summary to audio using TTS
    const audioUrl = await convertToAudio(summaryText, title);

    // Create book record
    const book = await Book.create({
      title,
      lecturerId,
      pdfUrl,
      coverUrl,
      category,
      summaryText,
      audioUrl,
      saveCount: 0,
    });

    // Cleanup temp file
    cleanupTempFile(pdfPath);

    return successResponse(res, book, 'Book uploaded successfully', 201);
  } catch (error) {
    console.error('Upload book error:', error);
    if (req.file) cleanupTempFile(req.file.path);
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get all books
// @route   GET /api/books
// @access  Private
const getAllBooks = async (req, res) => {
  try {
    const { category, lecturerId, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (lecturerId) query.lecturerId = lecturerId;

    const books = await Book.find(query)
      .populate('lecturerId', 'name profilePicture specialty institution')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Book.countDocuments(query);

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

// @desc    Get single book by ID
// @route   GET /api/books/:id
// @access  Private
const getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
      .populate('lecturerId', 'name profilePicture specialty institution');

    if (!book) {
      return errorResponse(res, 'Book not found', 404);
    }

    // Track view
    await View.create({
      bookId: book._id,
      userId: req.user._id,
      ipAddress: req.ip,
    });

    return successResponse(res, book, 'Book fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Delete book
// @route   DELETE /api/books/:id
// @access  Lecturer only (owner)
const deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return errorResponse(res, 'Book not found', 404);
    }

    if (book.lecturerId.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Not authorized to delete this book', 403);
    }

    await book.deleteOne();
    await Save.deleteMany({ bookId: req.params.id });

    return successResponse(res, null, 'Book deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get lecturer's books
// @route   GET /api/books/lecturer/my-books
// @access  Lecturer only
const getMyBooks = async (req, res) => {
  try {
    console.log('📚 Getting books for lecturer:', req.user._id);
    
    const books = await Book.find({ lecturerId: req.user._id })
      .sort({ createdAt: -1 });

    console.log(`📚 Found ${books.length} books`);
    console.log('📚 First book sample:', books[0] ? books[0].title : 'No books');

    return successResponse(res, books, 'Books fetched successfully');
  } catch (error) {
    console.error('❌ Get my books error:', error);
    console.error('❌ Error stack:', error.stack);
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  uploadBook,
  getAllBooks,
  getBookById,
  deleteBook,
  getMyBooks,
};
