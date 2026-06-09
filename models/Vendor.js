const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  vendorName: { type: String, required: true },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  gstNumber: { type: String, default: '' },

  vendorType: {
    type: String,
    enum: ['Material Supplier', 'Contractor', 'Electrician', 'Plumber', 'Painter', 'Welder', 'Transport'],
    default: 'Material Supplier',
  },

  materialType: { type: String, default: '' },
  paymentPending: { type: Number, default: 0 },
  totalPurchase: { type: Number, default: 0 },

  paymentHistory: [{
    date: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    note: { type: String, default: '' },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);
