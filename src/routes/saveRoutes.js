const express = require('express');
const {
  saveBook,
  unsaveBook,
  checkSaved,
  getSavedBooks,
} = require('../controllers/saveController');
const { protect } = require('../middleware/authMiddleware');
const { isStudent } = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/:bookId', protect, isStudent, saveBook);
router.delete('/:bookId', protect, isStudent, unsaveBook);
router.get('/check/:bookId', protect, isStudent, checkSaved);
router.get('/', protect, isStudent, getSavedBooks);

module.exports = router;
