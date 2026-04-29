const express = require('express');
const {
  getLibrary,
  getSavedBookIds,
  recordDownload,
} = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const { isStudent } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/library', protect, isStudent, getLibrary);
router.get('/saved-books', protect, isStudent, getSavedBookIds);
router.post('/downloads', protect, isStudent, recordDownload);

module.exports = router;