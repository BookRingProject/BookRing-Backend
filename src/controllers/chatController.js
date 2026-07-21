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
    console.log('💬 [chatWithBook] ========== NEW CHAT REQUEST ==========');
    console.log('📝 [chatWithBook] Request body:', JSON.stringify(req.body, null, 2));
    
    const { message, bookId } = req.body;
    const userId = req.user._id;

    console.log(`👤 [chatWithBook] User ID: ${userId}`);
    console.log(`📝 [chatWithBook] Message: "${message}"`);
    console.log(`📚 [chatWithBook] Book ID provided: ${bookId || 'None'}`);

    // Validate input
    if (!message || message.trim().length === 0) {
      console.log('❌ [chatWithBook] Empty message received');
      return errorResponse(res, 'Please enter a message', 400);
    }

    let book = null;
    let bookFound = false;

    // Case 1: User specified a bookId (direct reference)
    if (bookId) {
      console.log(`🔍 [chatWithBook] Searching for book by ID: ${bookId}`);
      book = await Book.findOne({
        _id: bookId,
      });
      
      if (book) {
        bookFound = true;
        console.log(`✅ [chatWithBook] Book found by ID: "${book.title}"`);
      } else {
        console.log(`❌ [chatWithBook] No book found with ID: ${bookId}`);
      }
    }

    // Case 2: User didn't specify bookId - search by title from message
    if (!book) {
      console.log('🔍 [chatWithBook] Searching for book by title from message...');
      const searchResult = await searchBookByTitle(message, userId);
      if (searchResult) {
        book = searchResult.book;
        bookFound = true;
        console.log(`✅ [chatWithBook] Book found by title search: "${book.title}"`);
        console.log(`   📊 Match type: ${searchResult.matchedBy}`);
      } else {
        console.log('❌ [chatWithBook] No book found by title search');
      }
    }

    // If no book found, respond accordingly
    if (!bookFound || !book) {
      console.log('❌ [chatWithBook] No book found. Returning "no match" response.');
      return successResponse(res, {
        reply: "I couldn't find any book matching your request. Please specify the exact title of the book you'd like to discuss, or upload it first.",
        bookFound: false,
        bookTitle: null
      }, 'No matching book found');
    }

    // Log book details
    console.log(`📖 [chatWithBook] Selected book:`);
    console.log(`   Title: "${book.title}"`);
    console.log(`   ID: ${book._id}`);
    console.log(`   PDF URL: ${book.pdfUrl}`);
    console.log(`   Is Image Based: ${book.isImageBased}`);
    console.log(`   Category: ${book.category}`);
    console.log(`   Lecturer: ${book.lecturerId}`);

    // Determine file type and URL
    const fileUrl = book.pdfUrl;
    const mimeType = book.isImageBased ? 'image/jpeg' : 'application/pdf';
    
    if (!fileUrl) {
      console.log('❌ [chatWithBook] Book has no file URL');
      return errorResponse(res, 'This book has no file attached. Please upload the file first.', 400);
    }

    console.log(`📄 [chatWithBook] File URL: ${fileUrl}`);
    console.log(`📋 [chatWithBook] MIME Type: ${mimeType}`);

    // Send to Gemini with the file and user message
    console.log('🤖 [chatWithBook] Sending to Gemini...');
    const aiReply = await chatWithFile(fileUrl, mimeType, message, book.title);
    console.log(`✅ [chatWithBook] Gemini response received. Length: ${aiReply.length} chars`);

    console.log('💬 [chatWithBook] ========== CHAT COMPLETE ==========');
    
    return successResponse(res, {
      reply: aiReply,
      bookFound: true,
      bookTitle: book.title,
      bookId: book._id
    }, 'Response generated successfully');

  } catch (error) {
    console.error('❌ [chatWithBook] Chat error:', error);
    console.error('   Stack:', error.stack);
    
    // Check if all API keys are exhausted
    if (error.message?.includes('All Gemini API keys have reached their daily quota') ||
        error.message?.includes('All AI service keys are currently exhausted')) {
      return errorResponse(
        res, 
        'All AI service keys are currently exhausted. Please try again after midnight when quotas reset.', 
        503
      );
    }
    
    // Check if it's a quota/rate limit error that wasn't caught by key rotation
    if (error.message?.includes('429') || 
        error.message?.includes('quota') || 
        error.message?.includes('rate limit') ||
        error.message?.includes('RESOURCE_EXHAUSTED')) {
      return errorResponse(
        res, 
        'The AI service is currently at capacity. Please try again in a few minutes.', 
        429
      );
    }
    
    // Check if file access error
    if (error.message?.includes('Could not access the book file') ||
        error.message?.includes('Failed to fetch file')) {
      return errorResponse(
        res, 
        'Could not access the book file. Please make sure the file is publicly accessible.', 
        400
      );
    }
    
    // Generic error
    return errorResponse(res, 'Failed to process your request. Please try again.', 500);
  }
};

module.exports = {
  chatWithBook,
};
