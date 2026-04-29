const express = require('express');
const { getTrendingBooks } = require('../controllers/trendController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/books', protect, getTrendingBooks);

module.exports = router;