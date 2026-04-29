const Book = require('../models/Book');
const Follow = require('../models/Follow');
const Save = require('../models/Save');
const View = require('../models/View');
const { calculatePerformance } = require('../services/performanceService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Get lecturer dashboard stats
// @route   GET /api/dashboard/stats
// @access  Lecturer only
const getDashboardStats = async (req, res) => {
  try {
    const lecturerId = req.user._id;

    // Get publications count
    const publications = await Book.countDocuments({ lecturerId });

    // Get followers count
    const followers = await Follow.countDocuments({ lecturerId });

    // Get follower change (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const previousFollowers = await Follow.countDocuments({
      lecturerId,
      createdAt: { $lt: thirtyDaysAgo }
    });
    const followerChange = followers - previousFollowers;

    // Get total saves across all books
    const books = await Book.find({ lecturerId });
    let totalSaves = 0;
    for (const book of books) {
      totalSaves += book.saveCount;
    }

    // Get new saves (last 30 days)
    let newSaves = 0;
    for (const book of books) {
      const recentSaves = await Save.countDocuments({
        bookId: book._id,
        createdAt: { $gte: thirtyDaysAgo }
      });
      newSaves += recentSaves;
    }

    return successResponse(res, {
      publications,
      followers,
      followerChange,
      totalSaves,
      saveChange: newSaves,
    }, 'Dashboard stats fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get top 5 most saved books
// @route   GET /api/dashboard/top-books
// @access  Lecturer only
const getTopBooks = async (req, res) => {
  try {
    const books = await Book.find({ lecturerId: req.user._id })
      .sort({ saveCount: -1 })
      .limit(5)
      .select('title saveCount coverUrl');

    return successResponse(res, books, 'Top books fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get performance data for chart
// @route   GET /api/dashboard/performance
// @access  Lecturer only
const getPerformanceData = async (req, res) => {
  try {
    const performance = await calculatePerformance(req.user._id);
    return successResponse(res, performance, 'Performance data fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  getDashboardStats,
  getTopBooks,
  getPerformanceData,
};