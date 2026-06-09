const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  date: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  note: { type: String, default: '' },
}, { _id: false });

const attendanceRecordSchema = new mongoose.Schema({
  date: { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Half Day'], required: true },
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', default: null },
}, { _id: false });

const employeeSchema = new mongoose.Schema({
  employeeName: { type: String, required: true },
  employeeCode: { type: String, default: '' },
  mobileNumber: { type: String, default: '' },
  address: { type: String, default: '' },
  roleTitle: { type: String, default: '' },
  employeeType: {
    type: String,
    enum: ['Company Staff', 'Permanent', 'Temporary', 'Weekly Contract', 'Daily Wage'],
    default: 'Permanent',
  },

  // Employee category for building work types
  category: {
    type: String,
    enum: [
      'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Painter',
      'Welder', 'Contractor', 'Labour', 'Helper', 'Temporary Worker',
      'Other',
    ],
    default: 'Labour',
  },

  salaryType: { type: String, enum: ['Daily', 'Weekly', 'Monthly'], default: 'Monthly' },
  salaryAmount: { type: Number, default: 0 },
  joiningDate: { type: String, default: '' },
  workStartDate: { type: String, default: '' },
  workEndDate: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },

  assignedBuildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', default: null },
  previousBuildings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Building' }],

  attendance: {
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    halfDay: { type: Number, default: 0 },
    todayStatus: { type: String, enum: ['Present', 'Absent', 'Half Day'], default: 'Present' },
  },
  attendanceRecords: [attendanceRecordSchema],

  leaveUsed: { type: Number, default: 0 },
  extraLeave: { type: Number, default: 0 },
  leaveBalance: { type: Number, default: 4 },

  paymentHistory: [paymentHistorySchema],
  northIndian: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
