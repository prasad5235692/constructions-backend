const mongoose = require('mongoose');

const workSchema = new mongoose.Schema({
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
    index: true,
  },
  workDate: {
    type: String,
    required: true,
    index: true,
  },
  workTypes: [{
    type: String,
    enum: ['Painting', 'Plumbing', 'Electrical', 'Masonry', 'Tiles', 'Carpentry', 'Welding', 'Roof Work', 'Flooring', 'Civil Work', 'Finishing', 'Other'],
  }],
  otherWorkName: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  assignedEmployeeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  }],
  status: {
    type: String,
    enum: ['Planned', 'In Progress', 'Completed'],
    default: 'Planned',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

module.exports = mongoose.model('Work', workSchema);
