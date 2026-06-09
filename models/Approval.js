const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
    index: true,
  },

  category: {
    type: String,
    enum: ['VST', 'UDG', 'PLAN'],
    required: true,
  },

  approvalName: {
    type: String,
    required: true,
  },

  status: {
    type: String,
    enum: ['Pending', 'Approved'],
    default: 'Pending',
  },

  amount: {
    type: Number,
    default: 0,
  },

  approvedDate: {
    type: Date,
  },

  remarks: {
    type: String,
    default: '',
  },

  documents: [
    {
      fileName: String,
      fileUrl: String,
      uploadedAt: Date,
    },
  ],

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

approvalSchema.index({ buildingId: 1, status: 1 });
approvalSchema.index({ buildingId: 1, category: 1 });
approvalSchema.index({ buildingId: 1, category: 1, approvalName: 1 }, { unique: true });

module.exports = mongoose.model('Approval', approvalSchema);
