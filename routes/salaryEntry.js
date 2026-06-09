const express = require('express');
const SalaryEntry = require('../models/SalaryEntry');
const Advance = require('../models/Advance');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// GET /api/salary-entry/building/:buildingId
router.get('/building/:buildingId', auth, async (req, res) => {
  try {
    const { date, salaryType } = req.query;
    const queryDate = date || new Date().toISOString().split('T')[0];

    // Find employees who are Present today in this building
    const presentAttendance = await Attendance.find({
      buildingId: req.params.buildingId,
      attendanceDate: queryDate,
      status: 'Present',
    }).populate('employeeId', 'employeeName mobileNumber roleTitle employeeType salaryType salaryAmount');

    const employeeIds = presentAttendance.map((a) => a.employeeId?._id || a.employeeId);

    let employees = [];
    presentAttendance.forEach((a) => {
      if (a.employeeId) {
        employees.push(a.employeeId);
      }
    });

    if (salaryType) {
      employees = employees.filter((e) => e.salaryType === salaryType);
    }

    // Get salary entries for today
    const salaryEntries = await SalaryEntry.find({
      buildingId: req.params.buildingId,
      workDate: queryDate,
      ...(salaryType ? {} : {}),
    });

    const salaryEntryMap = {};
    salaryEntries.forEach((se) => {
      const eid = se.employeeId ? se.employeeId.toString() : '';
      salaryEntryMap[eid] = se;
    });

    // Build attendance map with check-in times
    const attendanceMap = {};
    presentAttendance.forEach((a) => {
      const eid = a.employeeId?._id ? a.employeeId._id.toString() : (a.employeeId ? a.employeeId.toString() : '');
      attendanceMap[eid] = {
        status: a.status,
        checkInTime: a.checkInTime || '',
        isLate: a.isLate || false,
        lateEntryTime: a.lateEntryTime || '',
        attendanceId: a._id,
      };
    });

    // Get advances for these employees
    const empIds = employees.map((e) => e._id || e.id);
    const advances = await Advance.find({
      employeeId: { $in: empIds },
      buildingId: req.params.buildingId,
    });

    const advanceMap = {};
    advances.forEach((a) => {
      const eid = a.employeeId ? a.employeeId.toString() : '';
      if (!advanceMap[eid]) advanceMap[eid] = { totalAmount: 0, pendingAmount: 0 };
      advanceMap[eid].totalAmount += a.amount;
      advanceMap[eid].pendingAmount += a.pendingAmount || a.amount;
    });

    res.json({ employees, salaryEntryMap, attendanceMap, advanceMap });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/salary-entry/mark-paid
router.post('/mark-paid', auth, async (req, res) => {
  try {
    const { employeeId, buildingId, workDate, paidAmount } = req.body;

    if (!employeeId || !buildingId || !workDate) {
      return res.status(400).json({ message: 'employeeId, buildingId, and workDate are required' });
    }

    const existing = await SalaryEntry.findOne({ employeeId, workDate });

    if (!existing) {
      return res.status(404).json({ message: 'Salary entry not found' });
    }

    if (existing.paymentStatus === 'Paid') {
      return res.status(400).json({ message: 'Salary already marked as Paid for this date' });
    }

    const payAmt = paidAmount || existing.netAmount || existing.grossAmount;
    let newPaidAmount = (existing.paidAmount || 0) + payAmt;
    let paymentStatus = 'Unpaid';

    if (newPaidAmount >= (existing.netAmount || existing.grossAmount || 0)) {
      paymentStatus = 'Paid';
      newPaidAmount = existing.netAmount || existing.grossAmount || 0;
    } else if (newPaidAmount > 0) {
      paymentStatus = 'Partially Paid';
    }

    const salaryEntry = await SalaryEntry.findOneAndUpdate(
      { employeeId, workDate },
      {
        paidAmount: newPaidAmount,
        paymentStatus,
        paidDate: paymentStatus === 'Paid' ? new Date().toISOString().split('T')[0] : (existing.paidDate || ''),
      },
      { new: true },
    );

    res.json({ salaryEntry });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/salary-entry/history/:employeeId
router.get('/history/:employeeId', auth, async (req, res) => {
  try {
    const records = await SalaryEntry.find({ employeeId: req.params.employeeId })
      .sort({ workDate: -1 });
    res.json({ records });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
