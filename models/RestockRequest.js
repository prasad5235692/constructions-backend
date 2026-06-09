const mongoose = require('mongoose');

const restockRequestSchema = new mongoose.Schema({
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  sourceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuildingMaterial', required: true },
  category: { type: String, required: true },
  materialName: { type: String, required: true },
  brand: { type: String, default: '' },
  unit: { type: String, default: '' },
  quantity: { type: Number, required: true },
  unitRate: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedDate: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('RestockRequest', restockRequestSchema);
