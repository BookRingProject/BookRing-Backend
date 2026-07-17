const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const fs = require('fs');
const streamifier = require('streamifier');
const path = require('path');

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

// Upload to Supabase Storage (for image-based PDFs)
const uploadToSupabase = async (filePath, title) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileExtension = path.extname(filePath);
    const fileName = `${Date.now()}_${title.replace(/\s/g, '_')}${fileExtension}`;

    // Upload to Supabase bucket
    const { data, error } = await supabase.storage
      .from('books')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('books')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Supabase upload error:', error);
    throw new Error('Failed to upload to Supabase: ' + error.message);
  }
};

// Upload audio to Cloudinary
const uploadAudio = async (audioBuffer, title) => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'bookring/audio',
          resource_type: 'video',
          public_id: `${Date.now()}_${title.replace(/\s/g, '_')}`,
          format: 'mp3',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      
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
  uploadToSupabase,
  uploadAudio,
  uploadImage,
};
