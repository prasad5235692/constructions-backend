const mongoose = require('mongoose');

const salaryEntrySchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true,
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
    index: true,
  },
  attendanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance',
  },
  workDate: {
    type: String,
    required: true,
    index: true,
  },
  employeeType: {
    type: String,
    default: '',
  },
  salaryType: {
    type: String,
    enum: ['Daily', 'Weekly'],
  },
  rate: {
    type: Number,
    default: 0,
  },
  grossAmount: {
    type: Number,
    default: 0,
  },
  advanceAmount: {
    type: Number,
    default: 0,
  },
  netAmount: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Paid', 'Partially Paid'],
    default: 'Unpaid',
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  paidDate: {
    type: String,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

salaryEntrySchema.index({ employeeId: 1, workDate: 1 }, { unique: true });

module.exports = mongoose.model('SalaryEntry', salaryEntrySchema);
