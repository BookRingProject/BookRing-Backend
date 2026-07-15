const express = require('express');
const {
  uploadBook,
  uploadImageBook,
  getAllBooks,
  getBookById,
  deleteBook,
  getMyBooks,
} = require('../controllers/bookController');
const { protect } = require('../middleware/authMiddleware');
const { isLecturer } = require('../middleware/roleMiddleware');
const { upload, uploadPDFOnly, uploadImageOnly, handleUploadError } = require('../config/multer');

const router = express.Router();

// Updated: Now accepts PDF or Image via 'file' field
router.post('/upload', protect, isLecturer, upload.single('file'), handleUploadError, uploadBook);

// New: Image-only upload endpoint
router.post('/upload-image', protect, isLecturer, uploadImageOnly.single('image'), handleUploadError, uploadImageBook);

// Keep backward compatibility for existing frontend
router.post('/upload-pdf', protect, isLecturer, uploadPDFOnly.single('pdf'), handleUploadError, uploadBook);

router.get('/', protect, getAllBooks);
router.get('/my-books', protect, isLecturer, getMyBooks);
router.get('/:id', protect, getBookById);
router.delete('/:id', protect, isLecturer, deleteBook);

module.exports = router;
