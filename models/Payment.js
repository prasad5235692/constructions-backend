const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ['Salary', 'Labour', 'Vendor', 'Material', 'Expense', 'Land Expense', 'Other'],
    default: 'Other',
  },
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', default: null },
  landId: { type: mongoose.Schema.Types.ObjectId, ref: 'Land', default: null },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
  amount: { type: Number, required: true },
  dueDate: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Partial', 'Cancelled'],
    default: 'Pending',
  },
  remarks: { type: String, default: '' },
  frequency: { type: String, default: 'One Time' },
  paidTo: { type: String, default: '' },
  paidDate: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
