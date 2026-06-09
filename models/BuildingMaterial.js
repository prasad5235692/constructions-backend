const mongoose = require('mongoose');

const dailyUsageSchema = new mongoose.Schema({
  date: { type: String, required: true },
  totalUsed: { type: Number, default: 0 },
  openingStock: { type: Number, default: 0 },
  availableStock: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
}, { _id: false });

const paymentEntrySchema = new mongoose.Schema({
  type: { type: String, enum: ['Advance', 'Due', 'Final'], required: true },
  amount: { type: Number, required: true },
  date: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { _id: false });

const buildingMaterialSchema = new mongoose.Schema({
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },

  category: { type: String, required: true },
  materialName: { type: String, required: true },
  brand: { type: String, default: '' },
  unit: { type: String, default: '' },

  quantity: { type: Number, default: 0 },
  initialQuantity: { type: Number, default: 0 },
  restockedQuantity: { type: Number, default: 0 },
  usedQuantity: { type: Number, default: 0 },
  unitRate: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  vendorName: { type: String, default: '' },
  vendorPhone: { type: String, default: '' },
  vendorAddress: { type: String, default: '' },
  billNumber: { type: String, default: '' },

  paymentStatus: { type: String, enum: ['Pending', 'Advance Paid', 'Partially Paid', 'Fully Paid', 'Restocked'], default: 'Pending' },
  advancePaid: { type: Number, default: 0 },
  duePaid: { type: Number, default: 0 },
  finalPaid: { type: Number, default: 0 },
  paymentHistory: [paymentEntrySchema],

  isRestockOrder: { type: Boolean, default: false },
  sourceMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuildingMaterial', default: null },

  usageHistory: [dailyUsageSchema],

  addedDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

buildingMaterialSchema.virtual('availableQuantity').get(function () {
  return Math.max(0, (this.initialQuantity || 0) + (this.restockedQuantity || 0) - (this.usedQuantity || 0));
});

buildingMaterialSchema.virtual('remainingQuantity').get(function () {
  if (this.isRestockOrder) return Math.max(0, (this.quantity || 0) - (this.usedQuantity || 0));
  return this.availableQuantity;
});

buildingMaterialSchema.virtual('usagePercent').get(function () {
  const total = (this.initialQuantity || 0) + (this.restockedQuantity || 0);
  if (total === 0) return 0;
  return Math.round(((this.usedQuantity || 0) / total) * 100);
});

buildingMaterialSchema.virtual('totalValue').get(function () {
  return ((this.initialQuantity || 0) + (this.restockedQuantity || 0)) * (this.unitRate || 0);
});

module.exports = mongoose.model('BuildingMaterial', buildingMaterialSchema);
