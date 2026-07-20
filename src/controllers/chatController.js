/**
 * Chat Controller - BRbot AI Conversation Logic
 * MIT License
 * 
 * Handles incoming chat requests, processes user messages,
 * and returns AI-generated responses based on book content.
 */

const Book = require('../models/Book');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { chatWithFile } = require('../services/chatService');
const { searchBookByTitle } = require('../services/bookSearchService');

/**
 * @desc    Process user message and return AI response
 * @route   POST /api/chat
 * @access  Private
 */
const chatWithBook = async (req, res) => {
  try {
    const { message, bookId } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!message || message.trim().length === 0) {
      return errorResponse(res, 'Please enter a message', 400);
    }

    let book = null;
    let bookFound = false;

    // Case 1: User specified a bookId (direct reference)
    if (bookId) {
      book = await Book.findOne({
        _id: bookId,
        $or: [
          { lecturerId: userId },
          { isPublic: true } // If you have public books
        ]
      });
      
      if (book) {
        bookFound = true;
      }
    }

    // Case 2: User didn't specify bookId - search by title from message
    if (!book) {
      const searchResult = await searchBookByTitle(message, userId);
      if (searchResult) {
        book = searchResult.book;
        bookFound = true;
      }
    }

    // If no book found, respond accordingly
    if (!bookFound || !book) {
      return successResponse(res, {
        reply: "I couldn't find any book matching your request. Please specify the exact title of the book you'd like to discuss, or upload it first.",
        bookFound: false,
        bookTitle: null
      }, 'No matching book found');
    }

    // Determine file type and URL
    const fileUrl = book.pdfUrl;
    const mimeType = book.isImageBased ? 'image/jpeg' : 'application/pdf';
    
    if (!fileUrl) {
      return errorResponse(res, 'This book has no file attached. Please upload the file first.', 400);
    }

    // Send to Gemini with the file and user message
    const aiReply = await chatWithFile(fileUrl, mimeType, message, book.title);

    return successResponse(res, {
      reply: aiReply,
      bookFound: true,
      bookTitle: book.title,
      bookId: book._id
    }, 'Response generated successfully');

  } catch (error) {
    console.error('Chat error:', error);
    return errorResponse(res, 'Failed to process your request. Please try again.', 500);
  }
};

module.exports = {
  chatWithBook,
};
