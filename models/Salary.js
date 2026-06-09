const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
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
  salaryMonth: {
    type: Number,
    required: true,
  },
  salaryYear: {
    type: Number,
    required: true,
  },
  salaryType: {
    type: String,
    enum: ['Daily', 'Weekly'],
  },
  dailyRate: {
    type: Number,
    default: 0,
  },
  workingDays: {
    type: Number,
    default: 6,
  },
  presentDays: {
    type: Number,
    default: 0,
  },
  grossSalary: {
    type: Number,
    default: 0,
  },
  advanceAmount: {
    type: Number,
    default: 0,
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  netSalary: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Partially Paid', 'Paid'],
    default: 'Unpaid',
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

salarySchema.index({ employeeId: 1, salaryMonth: 1, salaryYear: 1 }, { unique: true });

module.exports = mongoose.model('Salary', salarySchema);
