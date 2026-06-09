const express = require('express');
const Vendor = require('../models/Vendor');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validation');

const router = express.Router();

// GET /api/vendors
router.get('/', auth, async (req, res) => {
  try {
    const { vendorType } = req.query;
    const filter = {};
    if (vendorType) filter.vendorType = vendorType;

    const vendors = await Vendor.find(filter).sort({ vendorName: 1 });
    res.json({ vendors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/vendors/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/vendors
router.post('/', auth, async (req, res) => {
  try {
    if (!isNonEmptyString(req.body.vendorName)) {
      return res.status(400).json({ message: 'Vendor name required' });
    }

    const vendor = await Vendor.create({
      vendorName: req.body.vendorName.trim(),
      phone: req.body.phone || '',
      email: req.body.email || '',
      address: req.body.address || '',
      gstNumber: req.body.gstNumber || '',
      vendorType: req.body.vendorType || 'Material Supplier',
      materialType: req.body.materialType || '',
    });

    await createAuditLog({
      module: 'vendors',
      action: 'create-vendor',
      entityType: 'Vendor',
      entityId: vendor._id,
      user: req.user,
      description: `Created vendor ${vendor.vendorName}`,
    });

    res.status(201).json({ vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/vendors/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.vendorName !== undefined && !isNonEmptyString(req.body.vendorName)) {
      return res.status(400).json({ message: 'Vendor name cannot be empty' });
    }

    const allowedFields = [
      'vendorName', 'phone', 'email', 'address', 'gstNumber',
      'vendorType', 'materialType', 'paymentPending', 'totalPurchase',
    ];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    const vendor = await Vendor.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    await createAuditLog({
      module: 'vendors',
      action: 'update-vendor',
      entityType: 'Vendor',
      entityId: vendor._id,
      user: req.user,
      description: `Updated vendor ${vendor.vendorName}`,
      changes: update,
    });

    res.json({ vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/vendors/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    await createAuditLog({
      module: 'vendors',
      action: 'delete-vendor',
      entityType: 'Vendor',
      entityId: vendor._id,
      user: req.user,
      description: `Deleted vendor ${vendor.vendorName}`,
    });

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/vendors/:id/payments
router.post('/:id/payments', auth, async (req, res) => {
  try {
    if (!req.body.amount || Number(req.body.amount) <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    vendor.paymentHistory.push({
      date: req.body.date || new Date().toISOString(),
      amount: req.body.amount || 0,
      note: req.body.note || '',
    });

    // Update totals
    if (req.body.amount) {
      vendor.totalPurchase = (vendor.totalPurchase || 0) + req.body.amount;
      vendor.paymentPending = Math.max(0, (vendor.paymentPending || 0) - req.body.amount);
    }

    await vendor.save();

    await createAuditLog({
      module: 'vendors',
      action: 'add-vendor-payment',
      entityType: 'Vendor',
      entityId: vendor._id,
      user: req.user,
      description: `Added payment for vendor ${vendor.vendorName}`,
      metadata: { amount: req.body.amount },
    });

    res.status(201).json({ vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
