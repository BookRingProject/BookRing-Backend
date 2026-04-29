const express = require('express');
const {
  getDashboardStats,
  getTopBooks,
  getPerformanceData,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { isLecturer } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/stats', protect, isLecturer, getDashboardStats);
router.get('/top-books', protect, isLecturer, getTopBooks);
router.get('/performance', protect, isLecturer, getPerformanceData);

module.exports = router;