const mongoose = require('mongoose');

const salaryMasterSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true },
  salaryType: { type: String, required: true, enum: ['Daily', 'Weekly'] },
  salaryAmount: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('SalaryMaster', salaryMasterSchema);
