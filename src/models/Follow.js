const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lecturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a student can follow a lecturer only once
followSchema.index({ studentId: 1, lecturerId: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followSchema);