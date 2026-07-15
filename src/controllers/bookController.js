const Book = require('../models/Book');
const User = require('../models/User');
const Save = require('../models/Save');
const View = require('../models/View');
const { validateBookUpload, validateImageUpload } = require('../validators/bookValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { uploadPDF, uploadAudio, uploadImage } = require('../services/uploadService');
const { summarizePDF, detectCategory, summarizeImage, isImageFile } = require('../services/aiService');
const { convertToAudio } = require('../services/ttsService');
const { extractCoverImage } = require('../services/pdfService');
const { cleanupTempFile } = require('../services/storageService');
const fs = require('fs');
const path = require('path');


/**
 * @desc    Upload a new book (PDF or Image)
 * @route   POST /api/books/upload
 * @access  Lecturer only
 */
const uploadBook = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload a PDF or image file', 400);
    }

    const { title } = req.body;
    const lecturerId = req.user._id;
    const filePath = req.file.path;
    const fileExtension = path.extname(filePath).toLowerCase();
    const isImage = isImageFile(filePath);

    // Validate based on file type
    const validation = validateBookUpload(title, filePath);
    if (!validation.isValid) {
      cleanupTempFile(filePath);
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    let pdfUrl = '';
    let coverUrl = '';
    let summaryText = '';
    let category = '';
    let audioUrl = '';
    let processedFilePath = filePath;

    // Case 1: PDF Upload
    if (!isImage) {
      // Extract cover image from PDF (keeping existing logic)
      const coverImagePath = await extractCoverImage(filePath);
      
      // Upload PDF to Cloudinary
      pdfUrl = await uploadPDF(filePath, title);
      
      // Upload cover image to Cloudinary if extracted
      if (coverImagePath) {
        coverUrl = await uploadImage(coverImagePath, `covers/${title}`);
        cleanupTempFile(coverImagePath);
      }

      // Detect category using AI with vision capabilities
      category = await detectCategory(filePath);

      // Summarize PDF using AI with vision capabilities
      summaryText = await summarizePDF(filePath);

    // Case 2: Image Upload (NEW)
    } else {
      // Upload image to Cloudinary as the main content
      const imageUrl = await uploadImage(filePath, `books/${title}`);
      pdfUrl = imageUrl; // Store image URL in pdfUrl field for consistency
      
      // Try to extract a cover from the image itself
      coverUrl = imageUrl; // Use the same image as cover

      // Detect category using AI with vision capabilities
      category = await detectCategory(filePath);

      // Summarize image using AI with vision capabilities (NEW)
      summaryText = await summarizeImage(filePath);

      // No PDF conversion needed for images
    }

    // Convert summary to audio using TTS
    if (summaryText) {
      audioUrl = await convertToAudio(summaryText, title);
    }

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
      isImageBased: isImage, // Add flag to track content type
    });

    // Cleanup temp file
    cleanupTempFile(filePath);

    return successResponse(res, book, 'Book uploaded successfully', 201);
  } catch (error) {
    console.error('Upload book error:', error);
    if (req.file) cleanupTempFile(req.file.path);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * @desc    Upload and summarize a standalone image (convenience endpoint)
 * @route   POST /api/books/upload-image
 * @access  Lecturer only
 */
const uploadImageBook = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload an image file', 400);
    }

    const { title } = req.body;
    const lecturerId = req.user._id;
    const imagePath = req.file.path;

    // Validate it's actually an image
    if (!isImageFile(imagePath)) {
      cleanupTempFile(imagePath);
      return errorResponse(res, 'File must be an image (JPEG, PNG, WebP, etc.)', 400);
    }

    const validation = validateImageUpload(title, imagePath);
    if (!validation.isValid) {
      cleanupTempFile(imagePath);
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    // Upload image to Cloudinary
    const imageUrl = await uploadImage(imagePath, `books/${title}`);

    // Detect category using AI with vision
    const category = await detectCategory(imagePath);

    // Summarize image using AI with vision
    const summaryText = await summarizeImage(imagePath, {
      customPrompt: 'Please provide a detailed description and analysis of this image, including any visible text, objects, or concepts.'
    });

    // Convert summary to audio
    let audioUrl = '';
    if (summaryText) {
      audioUrl = await convertToAudio(summaryText, title);
    }

    // Create book record
    const book = await Book.create({
      title,
      lecturerId,
      pdfUrl: imageUrl, // Store image URL in pdfUrl field
      coverUrl: imageUrl,
      category,
      summaryText,
      audioUrl,
      saveCount: 0,
      isImageBased: true,
    });

    cleanupTempFile(imagePath);

    return successResponse(res, book, 'Image uploaded and summarized successfully', 201);
  } catch (error) {
    console.error('Upload image error:', error);
    if (req.file) cleanupTempFile(req.file.path);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * @desc    Get all books
 * @route   GET /api/books
 * @access  Private
 */
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

/**
 * @desc    Get single book by ID
 * @route   GET /api/books/:id
 * @access  Private
 */
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

/**
 * @desc    Delete book
 * @route   DELETE /api/books/:id
 * @access  Lecturer only (owner)
 */
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

/**
 * @desc    Get lecturer's books
 * @route   GET /api/books/lecturer/my-books
 * @access  Lecturer only
 */
const getMyBooks = async (req, res) => {
  try {
    console.log('📚 Getting books for lecturer:', req.user._id);
    
    const books = await Book.find({ lecturerId: req.user._id })
      .sort({ createdAt: -1 });

    console.log(`📚 Found ${books.length} books`);
    if (books.length > 0) {
      console.log('📚 First book sample:', books[0].title);
    }

    return successResponse(res, books, 'Books fetched successfully');
  } catch (error) {
    console.error('❌ Get my books error:', error);
    console.error('❌ Error stack:', error.stack);
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  uploadBook,
  uploadImageBook,
  getAllBooks,
  getBookById,
  deleteBook,
  getMyBooks,
};
