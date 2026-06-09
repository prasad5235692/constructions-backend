const express = require('express');
const Salary = require('../models/Salary');
const Advance = require('../models/Advance');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// GET /api/salary/building/:buildingId
router.get('/building/:buildingId', auth, async (req, res) => {
  try {
    const { salaryType, month, year } = req.query;
    const now = new Date();
    const queryMonth = month ? parseInt(month, 10) : (now.getMonth() + 1);
    const queryYear = year ? parseInt(year, 10) : now.getFullYear();

    const monthStr = String(queryMonth).padStart(2, '0');
    const yearStr = String(queryYear);

    const employeeFilter = { assignedBuildingId: req.params.buildingId };
    if (salaryType) {
      employeeFilter.salaryType = salaryType;
    }

    const employees = await Employee.find(employeeFilter)
      .populate('assignedBuildingId', 'buildingName')
      .sort({ createdAt: -1 });

    const salaryRecords = await Salary.find({
      buildingId: req.params.buildingId,
      salaryMonth: queryMonth,
      salaryYear: queryYear,
      ...(salaryType ? { salaryType } : {}),
    }).populate('employeeId', 'employeeName mobileNumber roleTitle salaryType salaryAmount');

    // Get attendance counts for the month
    const attendanceRecords = await Attendance.find({
      buildingId: req.params.buildingId,
      attendanceDate: { $regex: `^${yearStr}-${monthStr}` },
    });

    const attendanceMap = {};
    attendanceRecords.forEach((a) => {
      const eid = a.employeeId ? a.employeeId.toString() : '';
      if (!attendanceMap[eid]) attendanceMap[eid] = { present: 0, absent: 0, leave: 0 };
      if (a.status === 'Present') attendanceMap[eid].present += 1;
      else if (a.status === 'Absent') attendanceMap[eid].absent += 1;
      else if (a.status === 'Leave') attendanceMap[eid].leave += 1;
    });

    // Get advances for these employees
    const employeeIds = employees.map((e) => e._id);
    const advances = await Advance.find({
      employeeId: { $in: employeeIds },
      buildingId: req.params.buildingId,
    });

    const advanceMap = {};
    advances.forEach((a) => {
      const eid = a.employeeId ? a.employeeId.toString() : '';
      if (!advanceMap[eid]) advanceMap[eid] = { totalAmount: 0, pendingAmount: 0 };
      advanceMap[eid].totalAmount += a.amount;
      advanceMap[eid].pendingAmount += a.pendingAmount || a.amount;
    });

    const salaryMap = {};
    salaryRecords.forEach((r) => {
      const eid = r.employeeId?._id ? r.employeeId._id.toString() : r.employeeId.toString();
      salaryMap[eid] = r;
    });

    res.json({ employees, salaryMap, attendanceMap, advanceMap });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/salary/mark-paid
router.post('/mark-paid', auth, async (req, res) => {
  try {
    const { employeeId, buildingId, salaryMonth, salaryYear, salaryType, dailyRate, workingDays, presentDays, grossSalary, advanceAmount, paidAmount, netSalary } = req.body;

    if (!employeeId || !buildingId || salaryMonth == null || salaryYear == null) {
      return res.status(400).json({ message: 'employeeId, buildingId, salaryMonth, and salaryYear are required' });
    }

    const existing = await Salary.findOne({ employeeId, salaryMonth, salaryYear });

    let newPaidAmount = (paidAmount || 0);
    let paymentStatus = 'Unpaid';

    if (existing && existing.paymentStatus === 'Paid') {
      return res.status(400).json({ message: 'Salary already marked as Paid for this period' });
    }

    if (existing && existing.paymentStatus === 'Partially Paid') {
      newPaidAmount = (existing.paidAmount || 0) + (paidAmount || 0);
    }

    if (newPaidAmount >= (netSalary || grossSalary || 0)) {
      paymentStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'Partially Paid';
    } else {
      paymentStatus = 'Unpaid';
    }

    const salary = await Salary.findOneAndUpdate(
      { employeeId, salaryMonth, salaryYear },
      {
        employeeId,
        buildingId,
        salaryMonth,
        salaryYear,
        salaryType: salaryType || 'Daily',
        dailyRate: dailyRate || 0,
        workingDays: workingDays || 6,
        presentDays: presentDays || 0,
        grossSalary: grossSalary || 0,
        advanceAmount: advanceAmount || 0,
        paidAmount: newPaidAmount,
        netSalary: netSalary || 0,
        paymentStatus,
        paidDate: paymentStatus === 'Paid' ? new Date().toISOString().split('T')[0] : (existing?.paidDate || ''),
        createdBy: req.user._id,
      },
      { upsert: true, new: true },
    ).populate('employeeId', 'employeeName mobileNumber roleTitle salaryType salaryAmount');

    // If full paid, mark advances as recovered
    if (paymentStatus === 'Paid' && advanceAmount > 0) {
      const advances = await Advance.find({
        employeeId,
        buildingId,
        pendingAmount: { $gt: 0 },
      }).sort({ createdAt: 1 });

      let remainingRecovery = advanceAmount;
      for (const adv of advances) {
        if (remainingRecovery <= 0) break;
        const recoverFromThis = Math.min(remainingRecovery, adv.pendingAmount);
        adv.recoveredAmount += recoverFromThis;
        adv.pendingAmount = adv.amount - adv.recoveredAmount;
        await adv.save();
        remainingRecovery -= recoverFromThis;
      }
    }

    res.json({ salary });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/salary/history/:employeeId
router.get('/history/:employeeId', auth, async (req, res) => {
  try {
    const records = await Salary.find({ employeeId: req.params.employeeId })
      .sort({ salaryYear: -1, salaryMonth: -1 })
      .populate('employeeId', 'employeeName mobileNumber roleTitle salaryType salaryAmount');
    res.json({ records });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
