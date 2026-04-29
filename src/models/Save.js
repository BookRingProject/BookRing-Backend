const mongoose = require('mongoose');

const saveSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a student can save a book only once
saveSchema.index({ studentId: 1, bookId: 1 }, { unique: true });

module.exports = mongoose.model('Save', saveSchema);