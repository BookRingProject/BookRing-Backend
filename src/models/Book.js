const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [100, 'Title must be less than 100 characters'],
    },
    lecturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    summaryText: {
      type: String,
      default: '',
    },
    audioUrl: {
      type: String,
      default: '',
    },
    coverUrl: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
    },
    saveCount: {
      type: Number,
      default: 0,
    },
    // NEW: Track if this is an image-based upload
    isImageBased: {
      type: Boolean,
      default: false,
    },
    // NEW: Track file type
    fileType: {
      type: String,
      enum: ['pdf', 'image'],
      default: 'pdf',
    },
    // NEW: Store file metadata
    fileMetadata: {
      size: Number,
      mimeType: String,
      originalName: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Book', bookSchema);
