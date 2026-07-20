
/**
 * Chat Routes - BRbot API Endpoints
 * MIT License
 * 
 * Defines the REST API endpoints for the BRbot chat functionality.
 * Handles user messages and returns AI-generated responses based on book content.
 */

const express = require('express');
const { chatWithBook } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   POST /api/chat
 * @desc    Send a message to BRbot and get an AI response
 * @access  Private (requires authentication)
 * @body    { message: string, bookId?: string }
 * @returns { reply: string, bookFound: boolean, bookTitle?: string }
 */
router.post('/', protect, chatWithBook);

/**
 * @route   GET /api/chat/history
 * @desc    Get user's chat history (optional feature)
 * @access  Private
 */
// router.get('/history', protect, getChatHistory);

/**
 * @route   DELETE /api/chat/history
 * @desc    Clear user's chat history (optional feature)
 * @access  Private
 */
// router.delete('/history', protect, clearChatHistory);

module.exports = router;
