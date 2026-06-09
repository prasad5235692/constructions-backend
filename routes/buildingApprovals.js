const express = require('express');
const mongoose = require('mongoose');
const Approval = require('../models/Approval');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router({ mergeParams: true });

const PREDEFINED_APPROVALS = {
  'VST': ['Advance', 'Bill', 'MISC'],
  'UDG': ['Advance', 'Bill', 'MISC'],
  'PLAN': ['Blueprint', 'LPA', 'Development', 'Union Bank Deposit', 'Panchayat Bill', 'Tax', 'President', 'ER', 'MISC', 'Online'],
};

function getUserId(user) {
  return user?._id || user?.id;
}

async function ensureApprovalsExist(buildingId, userId) {
  const existing = await Approval.find({ buildingId }).lean();
  const existingKeys = new Set(existing.map((a) => `${a.category}::${a.approvalName}`));

  const toCreate = [];
  for (const [category, names] of Object.entries(PREDEFINED_APPROVALS)) {
    for (const approvalName of names) {
      const key = `${category}::${approvalName}`;
      if (!existingKeys.has(key)) {
        toCreate.push({
          buildingId,
          category,
          approvalName,
          status: 'Pending',
          amount: 0,
          approvedDate: null,
          approvedBy: userId || undefined,
          remarks: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  if (toCreate.length > 0) {
    try {
      await Approval.insertMany(toCreate, { ordered: false });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  return Approval.find({ buildingId }).sort({ category: 1, approvalName: 1 });
}

// GET /api/buildings/:buildingId/approvals
router.get('/', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }

    const approvals = await ensureApprovalsExist(buildingId, getUserId(req.user));

    const categoryGroups = {};
    let completedCount = 0;
    let pendingCount = 0;

    for (const approval of approvals) {
      const cat = approval.category;
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(approval);
      if (approval.status === 'Approved') completedCount++;
      else pendingCount++;
    }

    const total = approvals.length;
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    res.json({
      approvals,
      categoryGroups,
      summary: { total, completed: completedCount, pending: pendingCount, progress },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/buildings/:buildingId/approvals
router.post('/', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { category, approvalName, amount, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }
    if (!category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (!approvalName || !approvalName.trim()) {
      return res.status(400).json({ message: 'Approval name is required' });
    }
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      return res.status(400).json({ message: 'Approved amount is required and must be greater than 0' });
    }

    let approval = await Approval.findOne({ buildingId, category, approvalName });

    if (approval) {
      approval.status = 'Approved';
      approval.amount = amt;
      approval.approvedDate = new Date();
      approval.approvedBy = getUserId(req.user);
      if (remarks) approval.remarks = remarks.trim();
      await approval.save();
    } else {
      approval = await Approval.create({
        buildingId,
        category,
        approvalName: approvalName.trim(),
        status: 'Approved',
        amount: amt,
        approvedDate: new Date(),
        approvedBy: getUserId(req.user),
        remarks: (remarks || '').trim(),
      });
    }

    res.json({ approval });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Approval record already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/buildings/:buildingId/approvals/:approvalId
router.patch('/:approvalId', auth, async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { status, amount, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(approvalId)) {
      return res.status(400).json({ message: 'Invalid approval ID' });
    }

    const approval = await Approval.findById(approvalId);
    if (!approval) return res.status(404).json({ message: 'Approval not found' });

    if (status === 'Approved') {
      const amt = amount !== undefined ? Number(amount) : approval.amount;
      if (amt <= 0) {
        return res.status(400).json({ message: 'Approved amount is required and must be greater than 0' });
      }
      approval.amount = amt;
      approval.approvedDate = new Date();
      approval.approvedBy = getUserId(req.user);
      if (remarks) approval.remarks = remarks.trim();
    }

    if (status) approval.status = status;
    await approval.save();

    res.json({ approval });

    updateBuildingToProcessing(req.params.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
