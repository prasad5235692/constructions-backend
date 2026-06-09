const express = require('express');
const Employee = require('../models/Employee');
const Building = require('../models/Building');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validation');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// GET /api/employees
router.get('/', auth, async (req, res) => {
  try {
    const { buildingId, category } = req.query;
    const filter = {};
    if (buildingId) filter.assignedBuildingId = buildingId;
    if (category) filter.category = category;

    const employees = await Employee.find(filter)
      .populate('assignedBuildingId', 'buildingName')
      .sort({ createdAt: -1 });
    res.json({ employees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/employees/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('assignedBuildingId', 'buildingName');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/employees
router.post('/', auth, async (req, res) => {
  try {
    if (!isNonEmptyString(req.body.employeeName)) {
      return res.status(400).json({ message: 'Employee name required' });
    }

    const employee = await Employee.create({
      employeeName: req.body.employeeName.trim(),
      employeeCode: req.body.employeeCode || '',
      mobileNumber: req.body.mobileNumber || '',
      address: req.body.address || '',
      roleTitle: req.body.role || req.body.roleTitle || '',
      employeeType: req.body.employeeType || 'Company Staff',
      category: req.body.category || 'Labour',
      salaryType: req.body.salaryType || 'Monthly',
      salaryAmount: req.body.salaryAmount || 0,
      joiningDate: req.body.joiningDate || '',
      workStartDate: req.body.workStartDate || '',
      workEndDate: req.body.workEndDate || '',
      assignedBuildingId: req.body.assignedBuildingId || req.body.buildingId || null,
      northIndian: req.body.northIndian || false,
    });

    if (employee.assignedBuildingId) {
      await Building.findByIdAndUpdate(employee.assignedBuildingId, {
        $addToSet: { employeeIds: employee._id },
      });
    }

    await createAuditLog({
      module: 'employees',
      action: 'create-employee',
      entityType: 'Employee',
      entityId: employee._id,
      user: req.user,
      description: `Created employee ${employee.employeeName}`,
    });

    res.status(201).json({ employee });

    if (employee.assignedBuildingId) updateBuildingToProcessing(employee.assignedBuildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.employeeName !== undefined && !isNonEmptyString(req.body.employeeName)) {
      return res.status(400).json({ message: 'Employee name cannot be empty' });
    }

    const allowedFields = [
      'employeeName', 'employeeCode', 'mobileNumber', 'address',
      'role', 'roleTitle', 'employeeType', 'category', 'salaryType',
      'salaryAmount', 'joiningDate', 'workStartDate', 'workEndDate',
      'assignedBuildingId', 'buildingId', 'status', 'northIndian',
      'leaveUsed', 'extraLeave', 'leaveBalance',
      'attendance',
    ];

    const update = {};
    const fieldMap = {
      role: 'roleTitle',
      buildingId: 'assignedBuildingId',
    };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const targetField = fieldMap[field] || field;
        update[targetField] = req.body[field];
      }
    }

    const employee = await Employee.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    await createAuditLog({
      module: 'employees',
      action: 'update-employee',
      entityType: 'Employee',
      entityId: employee._id,
      user: req.user,
      description: `Updated employee ${employee.employeeName}`,
      changes: update,
    });

    res.json({ employee });

    if (update.assignedBuildingId) updateBuildingToProcessing(update.assignedBuildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    // Remove employee from any building
    await Building.updateMany(
      { employeeIds: req.params.id },
      { $pull: { employeeIds: req.params.id } }
    );

    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    await createAuditLog({
      module: 'employees',
      action: 'delete-employee',
      entityType: 'Employee',
      entityId: employee._id,
      user: req.user,
      description: `Deleted employee ${employee.employeeName}`,
    });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/employees/:id/assign-building
router.put('/:id/assign-building', auth, async (req, res) => {
  try {
    const { buildingId } = req.body;
    if (!buildingId) return res.status(400).json({ message: 'Building ID required' });

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const building = await Building.findById(buildingId);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    // Remove from old building
    if (employee.assignedBuildingId) {
      await Building.findByIdAndUpdate(employee.assignedBuildingId, {
        $pull: { employeeIds: employee._id },
      });
    }

    // Track previous building
    if (employee.assignedBuildingId) {
      employee.previousBuildings.push(employee.assignedBuildingId);
    }

    employee.assignedBuildingId = buildingId;
    await employee.save();

    // Add to new building
    await Building.findByIdAndUpdate(buildingId, {
      $addToSet: { employeeIds: employee._id },
    });

    await createAuditLog({
      module: 'employees',
      action: 'assign-building',
      entityType: 'Employee',
      entityId: employee._id,
      user: req.user,
      description: `Assigned employee ${employee.employeeName} to ${building.buildingName}`,
      metadata: { buildingId },
    });

    res.json({ employee });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/employees/:id/remove-building
router.put('/:id/remove-building', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (employee.assignedBuildingId) {
      const previousBuildingId = employee.assignedBuildingId;
      await Building.findByIdAndUpdate(employee.assignedBuildingId, {
        $pull: { employeeIds: employee._id },
      });
      employee.previousBuildings.push(employee.assignedBuildingId);
      employee.assignedBuildingId = null;
      await employee.save();

      await createAuditLog({
        module: 'employees',
        action: 'remove-building',
        entityType: 'Employee',
        entityId: employee._id,
        user: req.user,
        description: `Removed employee ${employee.employeeName} from assigned building`,
        metadata: { previousBuildingId },
      });
    }

    res.json({ employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/employees/:id/transfer
router.put('/:id/transfer', auth, async (req, res) => {
  try {
    const { toBuildingId } = req.body;
    if (!toBuildingId) return res.status(400).json({ message: 'Target building ID required' });

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const targetBuilding = await Building.findById(toBuildingId);
    if (!targetBuilding) return res.status(404).json({ message: 'Target building not found' });

    const previousBuildingId = employee.assignedBuildingId;

    // Remove from old
    if (employee.assignedBuildingId) {
      await Building.findByIdAndUpdate(employee.assignedBuildingId, {
        $pull: { employeeIds: employee._id },
      });
    }

    // Track previous
    if (employee.assignedBuildingId) {
      employee.previousBuildings.push(employee.assignedBuildingId);
    }

    employee.assignedBuildingId = toBuildingId;
    await employee.save();

    // Add to new
    await Building.findByIdAndUpdate(toBuildingId, {
      $addToSet: { employeeIds: employee._id },
    });

    await createAuditLog({
      module: 'employees',
      action: 'transfer-employee',
      entityType: 'Employee',
      entityId: employee._id,
      user: req.user,
      description: `Transferred employee ${employee.employeeName} to ${targetBuilding.buildingName}`,
      metadata: { previousBuildingId, toBuildingId },
    });

    res.json({ employee });

    updateBuildingToProcessing(toBuildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/employees/:id/attendance
router.post('/:id/attendance', auth, async (req, res) => {
  try {
    const { date, status, buildingId } = req.body;
    if (!date || !status) {
      return res.status(400).json({ message: 'Date and status required' });
    }

    if (!['Present', 'Absent', 'Half Day'].includes(status)) {
      return res.status(400).json({ message: 'Invalid attendance status' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Remove existing attendance for same date
    employee.attendanceRecords = employee.attendanceRecords.filter(
      (r) => r.date !== date
    );

    employee.attendanceRecords.push({ date, status, buildingId: buildingId || null });

    // Recalculate counts
    const present = employee.attendanceRecords.filter((r) => r.status === 'Present').length;
    const absent = employee.attendanceRecords.filter((r) => r.status === 'Absent').length;
    const halfDay = employee.attendanceRecords.filter((r) => r.status === 'Half Day').length;

    employee.attendance.present = present;
    employee.attendance.absent = absent;
    employee.attendance.halfDay = halfDay;
    employee.attendance.todayStatus = status;

    await employee.save();

    await createAuditLog({
      module: 'employees',
      action: 'mark-attendance',
      entityType: 'Employee',
      entityId: employee._id,
      user: req.user,
      description: `Marked ${status} attendance for ${employee.employeeName}`,
      metadata: { date, buildingId: buildingId || null },
    });

    res.json({ employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/employees/:id/attendance
router.get('/:id/attendance', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const { month, year } = req.query;
    let records = employee.attendanceRecords;

    if (month && year) {
      records = records.filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() + 1 === parseInt(month) && d.getFullYear() === parseInt(year);
      });
    }

    res.json({ attendanceRecords: records, summary: employee.attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/employees/:id/payments
router.post('/:id/payments', auth, async (req, res) => {
  try {
    if (!req.body.amount || Number(req.body.amount) <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.paymentHistory.push({
      date: req.body.date || new Date().toISOString(),
      amount: req.body.amount || 0,
      note: req.body.note || '',
    });
    await employee.save();

    await createAuditLog({
      module: 'employees',
      action: 'add-employee-payment',
      entityType: 'Employee',
      entityId: employee._id,
      user: req.user,
      description: `Added payment for ${employee.employeeName}`,
      metadata: { amount: req.body.amount },
    });

    res.status(201).json({ employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
