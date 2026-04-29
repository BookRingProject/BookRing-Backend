const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const streamifier = require('streamifier');

// Upload PDF to Cloudinary
const uploadPDF = async (filePath, title) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'bookring/books',
      resource_type: 'raw',
      public_id: `${Date.now()}_${title.replace(/\s/g, '_')}`,
      format: 'pdf',
    });
    return result.secure_url;
  } catch (error) {
    console.error('PDF upload error:', error);
    throw new Error('Failed to upload PDF to Cloudinary');
  }
};

// Upload audio to Cloudinary
const uploadAudio = async (audioBuffer, title) => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'bookring/audio',
          resource_type: 'video', // Audio is treated as video type in Cloudinary
          public_id: `${Date.now()}_${title.replace(/\s/g, '_')}`,
          format: 'mp3',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      
      // Convert buffer to stream and pipe to Cloudinary
      const bufferStream = require('stream').Readable.from(Buffer.from(audioBuffer));
      bufferStream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    throw new Error('Failed to upload audio to Cloudinary: ' + error.message);
  }
};

// Upload image (cover) to Cloudinary
const uploadImage = async (filePath, title) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'bookring/covers',
      public_id: `${Date.now()}_${title.replace(/\s/g, '_')}`,
      transformation: [{ width: 300, height: 400, crop: 'fill' }],
    });
    return result.secure_url;
  } catch (error) {
    console.error('Image upload error:', error);
    return '';
  }
};

module.exports = {
  uploadPDF,
  uploadAudio,
  uploadImage,
};
