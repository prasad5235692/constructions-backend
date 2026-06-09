const express = require('express');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const SalaryEntry = require('../models/SalaryEntry');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// GET /api/attendance/building/:buildingId
router.get('/building/:buildingId', auth, async (req, res) => {
  try {
    const { date, employeeIds } = req.query;
    const employeeType = req.query.type || req.query.employeeType;

    const employeeFilter = { assignedBuildingId: req.params.buildingId };
    if (employeeType) {
      employeeFilter.employeeType = employeeType;
    }
    if (employeeIds) {
      const ids = employeeIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        employeeFilter._id = { $in: ids };
      }
    }

    const employees = await Employee.find(employeeFilter)
      .populate('assignedBuildingId', 'buildingName')
      .sort({ createdAt: -1 });

    let attendance = [];
    if (date) {
      attendance = await Attendance.find({
        buildingId: req.params.buildingId,
        attendanceDate: date,
      }).populate('employeeId', 'employeeName mobileNumber roleTitle employeeType salaryType salaryAmount');
    }

    res.json({ employees, attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/attendance
router.post('/', auth, async (req, res) => {
  try {
    const { employeeId, buildingId, attendanceDate, status, isLate, lateEntryTime, checkInTime } = req.body;

    if (!employeeId || !buildingId || !attendanceDate || !status) {
      return res.status(400).json({ message: 'employeeId, buildingId, attendanceDate, and status are required' });
    }

    if (!['Present', 'Absent', 'Leave'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Present, Absent, or Leave' });
    }

    const now = new Date();
    const defaultCheckIn = checkInTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const attendance = await Attendance.findOneAndUpdate(
      { employeeId, attendanceDate },
      {
        employeeId,
        buildingId,
        attendanceDate,
        status,
        checkInTime: status === 'Present' ? (checkInTime || defaultCheckIn) : '',
        isLate: isLate || false,
        lateEntryTime: lateEntryTime || '',
        markedBy: req.user._id,
      },
      { upsert: true, new: true },
    ).populate('employeeId', 'employeeName mobileNumber roleTitle employeeType salaryType salaryAmount');

    // Auto-create SalaryEntry when Present
    if (status === 'Present') {
      const employee = attendance.employeeId;
      const empType = employee?.employeeType || '';
      const salType = employee?.salaryType || 'Daily';
      const salAmount = employee?.salaryAmount || 0;

      let rate = 0;
      let grossAmount = 0;

      if (salType === 'Daily') {
        rate = salAmount;
        grossAmount = salAmount;
      } else if (salType === 'Weekly') {
        const weekDays = 6;
        rate = salAmount / weekDays;
        grossAmount = rate;
      }

      const advanceAmount = 0;
      const netAmount = grossAmount - advanceAmount;

      await SalaryEntry.findOneAndUpdate(
        { employeeId, workDate: attendanceDate },
        {
          employeeId,
          buildingId,
          attendanceId: attendance._id,
          workDate: attendanceDate,
          employeeType: empType,
          salaryType: salType,
          rate: Math.round(rate),
          grossAmount: Math.round(grossAmount),
          advanceAmount,
          netAmount: Math.round(netAmount),
          paymentStatus: 'Unpaid',
          paidAmount: 0,
          createdBy: req.user._id,
        },
        { upsert: true, new: true },
      );
    }

    res.json({ attendance });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/attendance/monthly
router.get('/monthly', auth, async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    if (!employeeId || !month || !year) {
      return res.status(400).json({ message: 'employeeId, month, and year are required' });
    }

    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year);
    const prefix = `${yearStr}-${monthStr}`;

    const records = await Attendance.find({
      employeeId,
      attendanceDate: { $regex: `^${prefix}` },
    });

    const present = records.filter((r) => r.status === 'Present').length;
    const absent = records.filter((r) => r.status === 'Absent').length;
    const leave = records.filter((r) => r.status === 'Leave').length;
    const late = records.filter((r) => r.isLate === true).length;

    res.json({ present, absent, leave, late, total: records.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
