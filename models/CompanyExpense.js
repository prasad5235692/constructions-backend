const mongoose = require('mongoose');

const companyExpenseSchema = new mongoose.Schema({
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
    index: true,
  },

  expenseName: {
    type: String,
    required: true,
  },

  category: {
    type: String,
    enum: ['Land Cleaning', 'Site Visit Expenses', 'Material Transportation', 'Machinery Expenses'],
    required: true,
  },

  isRental: {
    type: Boolean,
    default: false,
  },

  enabled: {
    type: Boolean,
    default: false,
  },

  hours: {
    type: Number,
    default: 0,
  },

  amount: {
    type: Number,
    default: 0,
  },

  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  enteredDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

companyExpenseSchema.index({ buildingId: 1, category: 1, expenseName: 1 }, { unique: true });

module.exports = mongoose.model('CompanyExpense', companyExpenseSchema);
