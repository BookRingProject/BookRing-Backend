const express = require('express');
const {
  getAllCategories,
  getBooksByCategory,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getAllCategories);
router.get('/:category/books', protect, getBooksByCategory);

module.exports = router;