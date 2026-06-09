const mongoose = require('mongoose');

const rateHistoryEntrySchema = new mongoose.Schema({
  rate: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: '' },
}, { _id: false });

const materialSchema = new mongoose.Schema({
  materialName: { type: String, required: true },
  category: {
    type: String,
    enum: ['Sand', 'Bricks', 'Cement', 'Steel', 'Electrical', 'Plumbing', 'Paint', 'Roofing', 'Other'],
    default: 'Other',
  },
  subCategory: { type: String, default: '' },
  brand: { type: String, default: '' },
  company: { type: String, default: '' },
  size: { type: String, default: '' },
  unit: { type: String, default: '' },
  rate: { type: Number, default: 0 },
  previousRate: { type: Number, default: 0 },
  rateUpdatedAt: { type: Date, default: Date.now },
  rateHistory: [rateHistoryEntrySchema],

  isMaster: { type: Boolean, default: true },
}, { timestamps: true });

const paymentEntrySchema = new mongoose.Schema({
  type: { type: String, enum: ['Advance', 'Due', 'Final'], required: true },
  amount: { type: Number, required: true },
  date: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { _id: false });

const buildingMaterialLedgerSchema = new mongoose.Schema({
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  materialName: { type: String, required: true },
  category: { type: String, default: '' },
  brand: { type: String, default: '' },
  unit: { type: String, default: '' },

  vendorName: { type: String, default: '' },
  vendorPhone: { type: String, default: '' },

  rateOverride: { type: Number, default: null },

  quantityAdded: { type: Number, default: 0 },
  quantityUsed: { type: Number, default: 0 },
  quantityRemaining: { type: Number, default: 0 },

  totalCost: { type: Number, default: 0 },
  usedCost: { type: Number, default: 0 },

  paymentStatus: { type: String, enum: ['Pending', 'Advance Paid', 'Partially Paid', 'Fully Paid'], default: 'Pending' },
  advancePaid: { type: Number, default: 0 },
  duePaid: { type: Number, default: 0 },
  finalPaid: { type: Number, default: 0 },
  paymentHistory: [paymentEntrySchema],

  transactions: [{
    type: { type: String, enum: ['add', 'use'], required: true },
    quantity: { type: Number, required: true },
    rate: { type: Number, default: null },
    amount: { type: Number, default: 0 },
    date: { type: String, default: '' },
    note: { type: String, default: '' },
  }],
}, { timestamps: true });

const Material = mongoose.model('Material', materialSchema);
const BuildingMaterialLedger = mongoose.model('BuildingMaterialLedger', buildingMaterialLedgerSchema);

module.exports = { Material, BuildingMaterialLedger };
