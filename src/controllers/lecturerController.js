const User = require('../models/User');
const Book = require('../models/Book');
const Follow = require('../models/Follow');
const { validateProfileUpdate } = require('../validators/userValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Get lecturer profile
// @route   GET /api/lecturers/:id
// @access  Private
const getLecturerProfile = async (req, res) => {
  try {
    const lecturer = await User.findById(req.params.id)
      .select('-password')
      .lean();

    if (!lecturer || lecturer.role !== 'lecturer') {
      return errorResponse(res, 'Lecturer not found', 404);
    }

    const publicationCount = await Book.countDocuments({ lecturerId: req.params.id });
    const followerCount = await Follow.countDocuments({ lecturerId: req.params.id });

    lecturer.publicationCount = publicationCount;
    lecturer.followerCount = followerCount;

    return successResponse(res, lecturer, 'Lecturer profile fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get all lecturers
// @route   GET /api/lecturers
// @access  Private
const getAllLecturers = async (req, res) => {
  try {
    const lecturers = await User.find({ role: 'lecturer' })
      .select('-password')
      .lean();

    for (let lecturer of lecturers) {
      lecturer.publicationCount = await Book.countDocuments({ lecturerId: lecturer._id });
      lecturer.followerCount = await Follow.countDocuments({ lecturerId: lecturer._id });
      
      if (req.user && req.user.role === 'student') {
        const isFollowing = await Follow.findOne({
          studentId: req.user._id,
          lecturerId: lecturer._id,
        });
        lecturer.isFollowing = !!isFollowing;
      }
    }

    return successResponse(res, lecturers, 'Lecturers fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Update lecturer profile
// @route   PUT /api/lecturers/profile
// @access  Lecturer only
const updateProfile = async (req, res) => {
  try {
    const validation = validateProfileUpdate(req.body, 'lecturer');
    if (!validation.isValid) {
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');

    return successResponse(res, updatedUser, 'Profile updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get lecturer's followers
// @route   GET /api/lecturers/:id/followers
// @access  Private
const getFollowers = async (req, res) => {
  try {
    const followers = await Follow.find({ lecturerId: req.params.id })
      .populate('studentId', 'name email profilePicture');

    const followerList = followers.map(f => f.studentId);

    return successResponse(res, followerList, 'Followers fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get lecturer's books
// @route   GET /api/lecturers/:id/books
// @access  Private
const getLecturerBooks = async (req, res) => {
  try {
    const books = await Book.find({ lecturerId: req.params.id })
      .sort({ createdAt: -1 });

    return successResponse(res, books, 'Books fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  getLecturerProfile,
  getAllLecturers,
  updateProfile,
  getFollowers,
  getLecturerBooks,
};