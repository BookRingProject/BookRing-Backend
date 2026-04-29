const cloudinary = require('../config/cloudinary');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Upload profile picture
// @route   POST /api/users/upload-avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded', 400);
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'bookring/avatars',
      transformation: [{ width: 200, height: 200, crop: 'fill' }],
    });

    // Update user's profile picture
    req.user.profilePicture = result.secure_url;
    await req.user.save();

    return successResponse(res, { url: result.secure_url }, 'Profile picture uploaded successfully');
  } catch (error) {
    console.error('Avatar upload error:', error);
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  uploadAvatar,
};
