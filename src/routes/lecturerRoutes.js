const express = require('express');
const {
  getLecturerProfile,
  getAllLecturers,
  updateProfile,
  getFollowers,
  getLecturerBooks,
} = require('../controllers/lecturerController');
const { protect } = require('../middleware/authMiddleware');
const { isLecturer } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', protect, getAllLecturers);
router.get('/profile', protect, isLecturer, (req, res) => {
  // Redirect to get profile with current user ID
  req.params.id = req.user._id;
  getLecturerProfile(req, res);
});
router.put('/profile', protect, isLecturer, updateProfile);
router.get('/:id', protect, getLecturerProfile);
router.get('/:id/followers', protect, getFollowers);
router.get('/:id/books', protect, getLecturerBooks);

module.exports = router;