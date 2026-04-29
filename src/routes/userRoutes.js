const express = require('express');
const { uploadAvatar } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/upload-avatar', protect, upload.single('avatar'), uploadAvatar);

module.exports = router;
