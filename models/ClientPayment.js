const mongoose = require('mongoose');

const clientPaymentSchema = new mongoose.Schema({
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
    index: true,
  },

  paymentType: {
    type: String,
    enum: ['Advance Payment', 'Second Payment', 'Third Payment', 'Final Payment'],
    required: true,
  },

  amount: {
    type: Number,
    required: true,
  },

  paymentDate: {
    type: Date,
    required: true,
  },

  notes: {
    type: String,
    default: '',
  },

  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

clientPaymentSchema.index({ buildingId: 1, paymentType: 1 });

module.exports = mongoose.model('ClientPayment', clientPaymentSchema);
