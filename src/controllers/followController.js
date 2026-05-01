const Follow = require('../models/Follow');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Follow a lecturer
// @route   POST /api/follows/:lecturerId
// @access  Student only
const followLecturer = async (req, res) => {
  try {
    const { lecturerId } = req.params;
    const studentId = req.user._id;

    console.log('📝 Follow request - Student ID:', studentId);
    console.log('📝 Follow request - Lecturer ID:', lecturerId);
    console.log('📝 Are they the same?', studentId.toString() === lecturerId);

    if (studentId.toString() === lecturerId) {
      console.log('❌ Self-follow prevented');
      return errorResponse(res, 'You cannot follow yourself', 400);
    }

    const lecturer = await User.findOne({ _id: lecturerId, role: 'lecturer' });
    if (!lecturer) {
      console.log('❌ Lecturer not found:', lecturerId);
      return errorResponse(res, 'Lecturer not found', 404);
    }

    const existingFollow = await Follow.findOne({ studentId, lecturerId });
    if (existingFollow) {
      console.log('❌ Already following');
      return errorResponse(res, 'Already following this lecturer', 400);
    }

    console.log('✅ Creating follow relationship');
    await Follow.create({ studentId, lecturerId });

    return successResponse(res, { following: true }, 'Lecturer followed successfully');
  } catch (error) {
    console.error('❌ Follow error details:', error);
    console.error('❌ Error message:', error.message);
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Unfollow a lecturer
// @route   DELETE /api/follows/:lecturerId
// @access  Student only
const unfollowLecturer = async (req, res) => {
  try {
    const { lecturerId } = req.params;
    const studentId = req.user._id;

    const result = await Follow.findOneAndDelete({ studentId, lecturerId });
    
    if (!result) {
      return errorResponse(res, 'Not following this lecturer', 404);
    }

    return successResponse(res, { following: false }, 'Lecturer unfollowed successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Check if following a lecturer
// @route   GET /api/follows/check/:lecturerId
// @access  Student only
const checkFollowing = async (req, res) => {
  try {
    const { lecturerId } = req.params;
    const studentId = req.user._id;

    const follow = await Follow.findOne({ studentId, lecturerId });
    
    return successResponse(res, { isFollowing: !!follow }, 'Check completed');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get all lecturers the student is following
// @route   GET /api/follows
// @access  Student only
const getFollowing = async (req, res) => {
  try {
    const follows = await Follow.find({ studentId: req.user._id })
      .populate('lecturerId', 'name profilePicture specialty institution')
      .sort({ createdAt: -1 });

    const lecturers = follows.map(follow => follow.lecturerId);

    return successResponse(res, lecturers, 'Following list fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  followLecturer,
  unfollowLecturer,
  checkFollowing,
  getFollowing,
};
