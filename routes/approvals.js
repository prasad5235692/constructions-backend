const express = require('express');
const mongoose = require('mongoose');
const Approval = require('../models/Approval');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

function getUserId(user) {
  return user?._id || user?.id;
}

// GET /api/approvals/building/:buildingId
router.get('/building/:buildingId', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }

    const approvals = await Approval.find({ buildingId }).sort({ category: 1, approvalName: 1 });

    const pending = approvals.filter((a) => a.status === 'Pending');
    const approved = approvals.filter((a) => a.status === 'Approved');

    const summary = {
      total: approvals.length,
      approved: approved.length,
      pending: pending.length,
      totalApprovedAmount: approved.reduce((sum, a) => sum + (a.amount || 0), 0),
      categoryStats: {},
    };

    for (const cat of ['VST', 'UDG', 'PLAN']) {
      const catApprovals = approvals.filter((a) => a.category === cat);
      summary.categoryStats[cat] = {
        total: catApprovals.length,
        approved: catApprovals.filter((a) => a.status === 'Approved').length,
        pending: catApprovals.filter((a) => a.status === 'Pending').length,
      };
    }

    res.json({ approvals, pending, approved, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/approvals
router.post('/', auth, async (req, res) => {
  try {
    const { buildingId, category, approvalName, amount, approvedDate, remarks, documents } = req.body;

    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }
    if (!['VST', 'UDG', 'PLAN'].includes(category)) {
      return res.status(400).json({ message: 'Category must be VST, UDG, or PLAN' });
    }
    if (!approvalName || !approvalName.trim()) {
      return res.status(400).json({ message: 'Approval name is required' });
    }

    const approval = await Approval.create({
      buildingId,
      category,
      approvalName: approvalName.trim(),
      amount: Number(amount) || 0,
      approvedDate: approvedDate || undefined,
      remarks: (remarks || '').trim(),
      documents: documents || [],
      createdBy: getUserId(req.user),
    });

    res.status(201).json({ approval });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/approvals/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { amount, approvedDate, remarks, documents } = req.body;

    const update = {};
    if (amount !== undefined) update.amount = Number(amount);
    if (approvedDate !== undefined) update.approvedDate = approvedDate;
    if (remarks !== undefined) update.remarks = remarks;
    if (documents !== undefined) update.documents = documents;

    const approval = await Approval.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!approval) return res.status(404).json({ message: 'Approval not found' });

    res.json({ approval });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/approvals/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status, amount, approvedDate } = req.body;
    if (!['Pending', 'Approved'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Pending or Approved' });
    }

    const approval = await Approval.findById(req.params.id);
    if (!approval) return res.status(404).json({ message: 'Approval not found' });

    if (status === 'Approved') {
      const amt = amount !== undefined ? Number(amount) : approval.amount;
      if (amt <= 0) {
        return res.status(400).json({ message: 'Amount is required before approving.' });
      }
      approval.amount = amt;
      approval.approvedDate = approvedDate || new Date();
      approval.approvedBy = getUserId(req.user);
    }

    approval.status = status;
    await approval.save();

    res.json({ approval });

    updateBuildingToProcessing(approval.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/approvals/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const approval = await Approval.findByIdAndDelete(req.params.id);
    if (!approval) return res.status(404).json({ message: 'Approval not found' });
    res.json({ message: 'Approval deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
