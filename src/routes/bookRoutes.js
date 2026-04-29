const express = require('express');
const {
  uploadBook,
  getAllBooks,
  getBookById,
  deleteBook,
  getMyBooks,
} = require('../controllers/bookController');
const { protect } = require('../middleware/authMiddleware');
const { isLecturer } = require('../middleware/roleMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/upload', protect, isLecturer, upload.single('pdf'), handleUploadError, uploadBook);
router.get('/', protect, getAllBooks);
router.get('/my-books', protect, isLecturer, getMyBooks);
router.get('/:id', protect, getBookById);
router.delete('/:id', protect, isLecturer, deleteBook);

module.exports = router;