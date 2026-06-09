const mongoose = require('mongoose');

const historyEntrySchema = new mongoose.Schema({
  time: { type: String, required: true },
  qty: { type: Number, required: true },
}, { _id: false });

const materialUsageSchema = new mongoose.Schema({
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  date: { type: String, required: true },
  usedQuantity: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  history: [historyEntrySchema],
}, { timestamps: true });

materialUsageSchema.index({ buildingId: 1, materialId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MaterialUsage', materialUsageSchema);
