const express = require('express');
const {
  followLecturer,
  unfollowLecturer,
  checkFollowing,
  getFollowing,
} = require('../controllers/followController');
const { protect } = require('../middleware/authMiddleware');
const { isStudent } = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/:lecturerId', protect, isStudent, followLecturer);
router.delete('/:lecturerId', protect, isStudent, unfollowLecturer);
router.get('/check/:lecturerId', protect, isStudent, checkFollowing);
router.get('/', protect, isStudent, getFollowing);

module.exports = router;
