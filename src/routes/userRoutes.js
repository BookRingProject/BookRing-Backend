const express = require('express');
const { uploadAvatar } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');
const { uploadImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/upload-avatar', protect, uploadImage.single('avatar'), uploadAvatar);

module.exports = router;
