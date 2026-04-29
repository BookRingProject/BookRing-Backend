const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const User = require('../models/User');

// @desc    Upload profile picture
// @route   POST /api/users/upload-avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded', 400);
    }

    console.log('Uploading avatar for user:', req.user._id);
    console.log('File path:', req.file.path);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'bookring/avatars',
      transformation: [{ width: 200, height: 200, crop: 'fill' }],
    });

    console.log('Cloudinary upload success:', result.secure_url);

    // Update user's profile picture in database
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: result.secure_url },
      { new: true }
    ).select('-password');

    // Clean up temp file
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return successResponse(res, { url: result.secure_url, user: updatedUser }, 'Profile picture uploaded successfully');
  } catch (error) {
    console.error('Avatar upload error:', error);
    
    // Clean up temp file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  uploadAvatar,
};
