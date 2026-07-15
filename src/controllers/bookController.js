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

const uploadBook = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload a PDF or image file', 400);
    }

    const { title, category: providedCategory } = req.body;
    const lecturerId = req.user._id;
    const filePath = req.file.path;
    const isImage = isImageFile(filePath);

    const validation = validateBookUpload(title, providedCategory, req.file);
    if (!validation.isValid) {
      cleanupTempFile(filePath);
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    let pdfUrl = '';
    let coverUrl = '';
    let summaryText = '';
    let category = providedCategory || '';
    let audioUrl = '';
    let fileType = 'pdf';
    let fileMetadata = {
      size: req.file.size,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    };

    // PDF Upload
    if (!isImage) {
      const coverImagePath = await extractCoverImage(filePath);
      pdfUrl = await uploadPDF(filePath, title);
      
      if (coverImagePath) {
        coverUrl = await uploadImage(coverImagePath, `covers/${title}`);
        cleanupTempFile(coverImagePath);
      }

      if (!category) {
        category = await detectCategory(filePath);
      }

      summaryText = await summarizePDF(filePath);
      fileType = 'pdf';

    // Image Upload
    } else {
      const imageUrl = await uploadImage(filePath, `books/${title}`);
      pdfUrl = imageUrl;
      coverUrl = imageUrl;

      if (!category) {
        category = await detectCategory(filePath);
      }

      summaryText = await summarizeImage(filePath, {
        customPrompt: 'Please provide a detailed description and analysis of this image, including any visible text, objects, or concepts.'
      });
      
      fileType = 'image';
    }

    if (summaryText && summaryText.length > 0) {
      try {
        audioUrl = await convertToAudio(summaryText, title);
      } catch (audioError) {
        console.warn('Audio conversion failed:', audioError.message);
      }
    }

    const book = await Book.create({
      title,
      lecturerId,
      pdfUrl,
      coverUrl,
      category,
      summaryText,
      audioUrl,
      saveCount: 0,
      isImageBased: isImage,
      fileType,
      fileMetadata,
    });

    cleanupTempFile(filePath);

    return successResponse(res, book, 'Book uploaded successfully', 201);
  } catch (error) {
    console.error('Upload book error:', error);
    if (req.file) cleanupTempFile(req.file.path);
    return errorResponse(res, error.message, 500);
  }
};

const uploadImageBook = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload an image file', 400);
    }

    const { title, category: providedCategory } = req.body;
    const lecturerId = req.user._id;
    const imagePath = req.file.path;

    if (!isImageFile(imagePath)) {
      cleanupTempFile(imagePath);
      return errorResponse(res, 'File must be an image (JPEG, PNG, WebP, etc.)', 400);
    }

    const validation = validateImageUpload(title, req.file, providedCategory);
    if (!validation.isValid) {
      cleanupTempFile(imagePath);
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    const imageUrl = await uploadImage(imagePath, `books/${title}`);

    let category = providedCategory;
    if (!category) {
      category = await detectCategory(imagePath);
    }

    const summaryText = await summarizeImage(imagePath, {
      customPrompt: 'Please provide a detailed description and analysis of this image, including any visible text, objects, or concepts.'
    });

    let audioUrl = '';
    if (summaryText && summaryText.length > 0) {
      try {
        audioUrl = await convertToAudio(summaryText, title);
      } catch (audioError) {
        console.warn('Audio conversion failed:', audioError.message);
      }
    }

    const book = await Book.create({
      title,
      lecturerId,
      pdfUrl: imageUrl,
      coverUrl: imageUrl,
      category,
      summaryText,
      audioUrl,
      saveCount: 0,
      isImageBased: true,
      fileType: 'image',
      fileMetadata: {
        size: req.file.size,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      },
    });

    cleanupTempFile(imagePath);

    return successResponse(res, book, 'Image uploaded and summarized successfully', 201);
  } catch (error) {
    console.error('Upload image error:', error);
    if (req.file) cleanupTempFile(req.file.path);
    return errorResponse(res, error.message, 500);
  }
};

// ... rest of your controller functions (getAllBooks, getBookById, deleteBook, getMyBooks) remain unchanged

module.exports = {
  uploadBook,
  uploadImageBook,
  getAllBooks,
  getBookById,
  deleteBook,
  getMyBooks,
};
