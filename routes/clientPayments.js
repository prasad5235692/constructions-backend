const express = require('express');
const mongoose = require('mongoose');
const ClientPayment = require('../models/ClientPayment');
const Building = require('../models/Building');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router({ mergeParams: true });

function getUserId(user) {
  return user?._id || user?.id;
}

function computeSummary(building, payments) {
  const paymentsTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const advanceAmt = building.advanceAmount || 0;
  const received = advanceAmt + paymentsTotal;
  const totalAmount = building.totalAmount || 0;
  const balance = Math.max(0, totalAmount - received);
  const status = balance <= 0 ? 'Completed' : 'Partially Paid';
  return { totalAmount, received, balance, status };
}

// GET /api/buildings/:buildingId/client-payments
router.get('/', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }

    const building = await Building.findById(buildingId);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    const payments = await ClientPayment.find({ buildingId }).sort({ paymentDate: 1, createdAt: 1 });

    res.json({
      building: {
        clientName: building.clientName || '',
        mobile: building.mobile || '',
        address: building.address || '',
        totalAmount: building.totalAmount || 0,
        advanceAvailable: building.advanceAvailable || 'No',
        advanceAmount: building.advanceAmount || 0,
        startDate: building.startDate || '',
      },
      payments,
      summary: computeSummary(building, payments),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/buildings/:buildingId/client-payments
router.post('/', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { paymentType, amount, paymentDate, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }
    if (!['Advance Payment', 'Second Payment', 'Third Payment'].includes(paymentType)) {
      return res.status(400).json({ message: 'paymentType must be Advance Payment, Second Payment, or Third Payment' });
    }
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    if (!paymentDate) {
      return res.status(400).json({ message: 'Payment date is required' });
    }

    const building = await Building.findById(buildingId);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    const existingPayments = await ClientPayment.find({ buildingId });
    const paymentsTotal = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalReceived = (building.advanceAmount || 0) + paymentsTotal;
    const balance = (building.totalAmount || 0) - totalReceived;

    if (amt > balance) {
      return res.status(400).json({ message: `Amount exceeds remaining balance of ${balance}` });
    }

    const payment = await ClientPayment.create({
      buildingId,
      paymentType,
      amount: amt,
      paymentDate: new Date(paymentDate),
      notes: (notes || '').trim(),
      receivedBy: getUserId(req.user),
    });

    if (paymentType === 'Advance Payment') {
      building.advanceAmount = (building.advanceAmount || 0) + amt;
      building.advanceAvailable = 'Yes';
    }
    building.totalReceivedPayment = totalReceived + amt;
    await building.save();

    const allPayments = await ClientPayment.find({ buildingId }).sort({ paymentDate: 1, createdAt: 1 });

    res.status(201).json({
      payment,
      payments: allPayments,
      building: {
        advanceAmount: building.advanceAmount || 0,
        advanceAvailable: building.advanceAvailable || 'No',
      },
      summary: computeSummary(building, allPayments),
    });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Duplicate payment record' });
    }
    res.status(500).json({ message: error.message });
  }
});

// POST /api/buildings/:buildingId/client-payments/final
router.post('/final', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { paymentDate, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }
    if (!paymentDate) {
      return res.status(400).json({ message: 'Payment date is required' });
    }

    const building = await Building.findById(buildingId);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    const existingPayments = await ClientPayment.find({ buildingId });
    const paymentsTotal = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalReceived = (building.advanceAmount || 0) + paymentsTotal;
    const balance = (building.totalAmount || 0) - totalReceived;

    if (balance <= 0) {
      return res.status(400).json({ message: 'No pending balance remaining' });
    }

    const payment = await ClientPayment.create({
      buildingId,
      paymentType: 'Final Payment',
      amount: balance,
      paymentDate: new Date(paymentDate),
      notes: (notes || '').trim(),
      receivedBy: getUserId(req.user),
    });

    building.totalReceivedPayment = totalReceived + balance;
    await building.save();

    const allPayments = await ClientPayment.find({ buildingId }).sort({ paymentDate: 1, createdAt: 1 });

    res.status(201).json({
      payment,
      payments: allPayments,
      summary: computeSummary(building, allPayments),
      completed: false,
    });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
