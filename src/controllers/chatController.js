'use strict';

const Book = require('../models/Book');
const {
  successResponse,
  errorResponse,
} = require('../utils/apiResponse');

const { chatWithFile } = require('../services/chatService');
const { searchBookByTitle } = require('../services/bookSearchService');

/**
 * @desc    Process user message and return AI response
 * @route   POST /api/chat
 * @access  Private
 */
const chatWithBook = async (req, res) => {
  try {
    console.log(
      '💬 [chatWithBook] ========== NEW CHAT REQUEST =========='
    );

    console.log(
      '📝 [chatWithBook] Request body:',
      JSON.stringify(req.body, null, 2)
    );

    const { message, bookId } = req.body || {};

    const userId = req.user?._id;

    if (!userId) {
      console.error(
        '❌ [chatWithBook] Missing authenticated user.'
      );

      return errorResponse(
        res,
        'Authentication required.',
        401
      );
    }

    console.log(`👤 [chatWithBook] User ID: ${userId}`);
    console.log(`📝 [chatWithBook] Message: "${message || ''}"`);
    console.log(
      `📚 [chatWithBook] Book ID provided: ${bookId || 'None'}`
    );

    // ---------------------------------------------------------
    // Validate message
    // ---------------------------------------------------------
    if (
      typeof message !== 'string' ||
      message.trim().length === 0
    ) {
      console.log(
        '❌ [chatWithBook] Empty or invalid message received.'
      );

      return errorResponse(
        res,
        'Please enter a message.',
        400
      );
    }

    const cleanMessage = message.trim();

    // ---------------------------------------------------------
    // Find book
    // ---------------------------------------------------------
    let book = null;

    // Case 1: Explicit book ID
    if (bookId) {
      console.log(
        `🔍 [chatWithBook] Searching for book by ID: ${bookId}`
      );

      try {
        book = await Book.findById(bookId);
      } catch (dbError) {
        console.error(
          '❌ [chatWithBook] Invalid or malformed book ID:',
          dbError.message
        );

        return errorResponse(
          res,
          'The selected book could not be found.',
          400
        );
      }

      if (book) {
        console.log(
          `✅ [chatWithBook] Book found by ID: "${book.title}"`
        );
      } else {
        console.log(
          `❌ [chatWithBook] No book found with ID: ${bookId}`
        );
      }
    }

    // Case 2: Search book by title
    if (!book) {
      console.log(
        '🔍 [chatWithBook] Searching for book by title from message...'
      );

      const searchResult = await searchBookByTitle(
        cleanMessage,
        userId
      );

      if (searchResult?.book) {
        book = searchResult.book;

        console.log(
          `✅ [chatWithBook] Book found by title search: "${book.title}"`
        );

        console.log(
          `   📊 Match type: ${
            searchResult.matchedBy || 'unknown'
          }`
        );
      } else {
        console.log(
          '❌ [chatWithBook] No book found by title search.'
        );
      }
    }

    // ---------------------------------------------------------
    // No book found
    // ---------------------------------------------------------
    if (!book) {
      console.log(
        '❌ [chatWithBook] No book found. Returning no-match response.'
      );

      return successResponse(
        res,
        {
          reply:
            "I couldn't find any book matching your request. Please specify the exact title of the book you'd like to discuss, or upload it first.",
          bookFound: false,
          bookTitle: null,
          bookId: null,
        },
        'No matching book found'
      );
    }

    // ---------------------------------------------------------
    // Log selected book
    // ---------------------------------------------------------
    console.log(
      '📖 [chatWithBook] Selected book:'
    );

    console.log(
      `   Title: "${book.title}"`
    );

    console.log(
      `   ID: ${book._id}`
    );

    console.log(
      `   PDF URL: ${book.pdfUrl || 'None'}`
    );

    console.log(
      `   Is Image Based: ${Boolean(book.isImageBased)}`
    );

    console.log(
      `   Category: ${book.category || 'None'}`
    );

    console.log(
      `   Lecturer: ${book.lecturerId || 'None'}`
    );

    // ---------------------------------------------------------
    // Validate file URL
    // ---------------------------------------------------------
    const fileUrl =
      typeof book.pdfUrl === 'string'
        ? book.pdfUrl.trim()
        : '';

    if (!fileUrl) {
      console.log(
        '❌ [chatWithBook] Book has no file URL.'
      );

      return errorResponse(
        res,
        'This book has no file attached. Please upload the file first.',
        400
      );
    }

    // ---------------------------------------------------------
    // Determine MIME type
    // ---------------------------------------------------------
    const mimeType = book.isImageBased
      ? 'image/jpeg'
      : 'application/pdf';

    console.log(
      `📄 [chatWithBook] File URL: ${fileUrl}`
    );

    console.log(
      `📋 [chatWithBook] MIME Type: ${mimeType}`
    );

    // ---------------------------------------------------------
    // Gemini request
    // ---------------------------------------------------------
    console.log(
      '🤖 [chatWithBook] Sending request to Gemini...'
    );

    const aiReply = await chatWithFile(
      fileUrl,
      mimeType,
      cleanMessage,
      book.title
    );

    if (
      typeof aiReply !== 'string' ||
      aiReply.trim().length === 0
    ) {
      console.error(
        '❌ [chatWithBook] Gemini returned an empty reply.'
      );

      return errorResponse(
        res,
        'The AI service returned an empty response. Please try again.',
        502
      );
    }

    console.log(
      `✅ [chatWithBook] Gemini response received. Length: ${aiReply.length} chars`
    );

    console.log(
      '💬 [chatWithBook] ========== CHAT COMPLETE =========='
    );

    return successResponse(
      res,
      {
        reply: aiReply,
        bookFound: true,
        bookTitle: book.title,
        bookId: book._id,
      },
      'Response generated successfully'
    );
  } catch (error) {
    console.error(
      '❌ [chatWithBook] Chat error:',
      error?.message || error
    );

    if (error?.stack) {
      console.error(
        '   Stack:',
        error.stack
      );
    }

    const errorCode = error?.code;
    const status = Number(error?.status);

    console.error(
      `   Error code: ${errorCode || 'NONE'}`
    );

    console.error(
      `   Error status: ${
        Number.isInteger(status) ? status : 'NONE'
      }`
    );

    // =========================================================
    // GEMINI QUOTA / ALL KEYS EXHAUSTED
    // =========================================================
    if (
      errorCode === 'GEMINI_QUOTA_EXCEEDED' ||
      errorCode === 'GEMINI_ALL_KEYS_EXHAUSTED' ||
      errorCode === 'GEMINI_RATE_LIMITED'
    ) {
      console.error(
        '🔴 [chatWithBook] Gemini quota/rate limit reached.'
      );

      return errorResponse(
        res,
        'The AI service has temporarily reached its request limit. Please try again later.',
        429
      );
    }

    // =========================================================
    // GEMINI AUTHENTICATION
    // =========================================================
    if (
      errorCode === 'GEMINI_AUTHENTICATION_ERROR' ||
      errorCode === 'GEMINI_AUTHORIZATION_ERROR'
    ) {
      console.error(
        '🔴 [chatWithBook] Gemini authentication/authorization failure.'
      );

      return errorResponse(
        res,
        'The AI service is temporarily unavailable. Please try again later.',
        502
      );
    }

    // =========================================================
    // FILE FETCH ERROR
    // =========================================================
    if (errorCode === 'FILE_FETCH_ERROR') {
      console.error(
        '🔴 [chatWithBook] Book file could not be fetched.'
      );

      return errorResponse(
        res,
        'Could not access the book file. Please make sure the file is publicly accessible.',
        400
      );
    }

    // =========================================================
    // BACKWARDS COMPATIBILITY:
    // Handle older service errors that may still use message text.
    // =========================================================
    const errorMessage = String(
      error?.message || ''
    ).toLowerCase();

    if (
      errorMessage.includes('all gemini api keys') ||
      errorMessage.includes('all ai service keys') ||
      errorMessage.includes('all keys exhausted')
    ) {
      console.error(
        '🔴 [chatWithBook] All Gemini keys exhausted.'
      );

      return errorResponse(
        res,
        'The AI service has temporarily reached its request limit. Please try again later.',
        429
      );
    }

    if (
      errorMessage.includes('quota') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('resource exhausted') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('generate_content_free_tier_requests') ||
      errorMessage.includes('429')
    ) {
      console.error(
        '🔴 [chatWithBook] Detected Gemini quota/rate-limit error from message.'
      );

      return errorResponse(
        res,
        'The AI service has temporarily reached its request limit. Please try again later.',
        429
      );
    }

    if (
      errorMessage.includes('could not access the book file') ||
      errorMessage.includes('failed to fetch file')
    ) {
      console.error(
        '🔴 [chatWithBook] Detected book file access error.'
      );

      return errorResponse(
        res,
        'Could not access the book file. Please make sure the file is publicly accessible.',
        400
      );
    }

    // =========================================================
    // INVALID REQUEST
    // =========================================================
    if (
      errorCode === 'EMPTY_GEMINI_RESPONSE' ||
      errorCode === 'INVALID_GEMINI_RESPONSE'
    ) {
      console.error(
        '🔴 [chatWithBook] Gemini returned an invalid response.'
      );

      return errorResponse(
        res,
        'The AI service returned an invalid response. Please try again.',
        502
      );
    }

    // =========================================================
    // GENERIC SERVER ERROR
    // =========================================================
    console.error(
      '🔴 [chatWithBook] Returning generic 500 error.'
    );

    return errorResponse(
      res,
      'Failed to process your request. Please try again.',
      500
    );
  }
};

module.exports = {
  chatWithBook,
};
