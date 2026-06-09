const express = require('express');
const Payment = require('../models/Payment');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validation');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// GET /api/payments
router.get('/', auth, async (req, res) => {
  try {
    const { buildingId, category, status } = req.query;
    const filter = {};
    if (buildingId) filter.buildingId = buildingId;
    if (category) filter.category = category;
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate('buildingId', 'buildingName')
      .populate('employeeId', 'employeeName')
      .populate('vendorId', 'vendorName')
      .sort({ createdAt: -1 });

    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/payments/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('buildingId', 'buildingName')
      .populate('employeeId', 'employeeName')
      .populate('vendorId', 'vendorName');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/payments
router.post('/', auth, async (req, res) => {
  try {
    if (!isNonEmptyString(req.body.title)) {
      return res.status(400).json({ message: 'Payment title required' });
    }

    if (!req.body.amount || Number(req.body.amount) <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    const payment = await Payment.create({
      title: req.body.title.trim(),
      category: req.body.category || 'Other',
      buildingId: req.body.buildingId || null,
      landId: req.body.landId || null,
      employeeId: req.body.employeeId || null,
      vendorId: req.body.vendorId || null,
      amount: req.body.amount || 0,
      dueDate: req.body.dueDate || '',
      status: req.body.status || 'Pending',
      remarks: req.body.remarks || '',
      frequency: req.body.frequency || 'One Time',
      paidTo: req.body.paidTo || '',
      paidDate: req.body.paidDate || '',
    });

    await createAuditLog({
      module: 'payments',
      action: 'create-payment',
      entityType: 'Payment',
      entityId: payment._id,
      user: req.user,
      description: `Created payment ${payment.title}`,
      metadata: { amount: payment.amount, status: payment.status },
    });

    res.status(201).json({ payment });

    if (payment.buildingId) updateBuildingToProcessing(payment.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/payments/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.title !== undefined && !isNonEmptyString(req.body.title)) {
      return res.status(400).json({ message: 'Payment title cannot be empty' });
    }

    if (req.body.amount !== undefined && Number(req.body.amount) <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    const allowedFields = [
      'title', 'category', 'amount', 'dueDate',
      'status', 'remarks', 'frequency', 'paidTo', 'paidDate',
    ];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    if (update.status === 'Paid' && !update.paidDate) {
      update.paidDate = new Date().toISOString();
    }

    const payment = await Payment.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    await createAuditLog({
      module: 'payments',
      action: 'update-payment',
      entityType: 'Payment',
      entityId: payment._id,
      user: req.user,
      description: `Updated payment ${payment.title}`,
      changes: update,
    });

    res.json({ payment });

    if (payment.buildingId) updateBuildingToProcessing(payment.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    await createAuditLog({
      module: 'payments',
      action: 'delete-payment',
      entityType: 'Payment',
      entityId: payment._id,
      user: req.user,
      description: `Deleted payment ${payment.title}`,
    });

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
