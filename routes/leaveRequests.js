const express = require('express');
const LeaveRequest = require('../models/LeaveRequest');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

const router = express.Router();

// GET /api/leave-requests
router.get('/', auth, async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;

    const leaveRequests = await LeaveRequest.find(filter)
      .populate('employeeId', 'employeeName roleTitle')
      .sort({ createdAt: -1 });

    res.json({ leaveRequests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/leave-requests
router.post('/', auth, async (req, res) => {
  try {
    const { employeeId, employeeName, fromDate, toDate, days, reason } = req.body;
    if (!employeeId || !fromDate || !toDate || !days) {
      return res.status(400).json({ message: 'Employee ID, dates, and days required' });
    }

    if (Number(days) <= 0) {
      return res.status(400).json({ message: 'Days must be greater than zero' });
    }

    const leaveRequest = await LeaveRequest.create({
      employeeId,
      employeeName: employeeName || '',
      fromDate,
      toDate,
      days,
      reason: reason || '',
    });

    await createAuditLog({
      module: 'leaveRequests',
      action: 'create-leave-request',
      entityType: 'LeaveRequest',
      entityId: leaveRequest._id,
      user: req.user,
      description: `Created leave request for ${leaveRequest.employeeName || employeeId}`,
      metadata: { days: leaveRequest.days },
    });

    res.status(201).json({ leaveRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/leave-requests/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (status && !['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const leaveRequest = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status: status || 'Pending' },
      { new: true }
    );

    if (!leaveRequest) return res.status(404).json({ message: 'Leave request not found' });

    await createAuditLog({
      module: 'leaveRequests',
      action: 'update-leave-request',
      entityType: 'LeaveRequest',
      entityId: leaveRequest._id,
      user: req.user,
      description: `Updated leave request ${leaveRequest._id}`,
      metadata: { status: leaveRequest.status },
    });

    res.json({ leaveRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
