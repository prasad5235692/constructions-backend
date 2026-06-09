const express = require('express');
const Work = require('../models/Work');
const Employee = require('../models/Employee');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

const WORK_TYPE_ROLES = {
  'Painting': ['Painter'],
  'Plumbing': ['Plumber'],
  'Electrical': ['Electrician'],
  'Masonry': ['Mason'],
  'Tiles': ['Mason', 'Helper'],
  'Carpentry': ['Carpenter'],
  'Welding': ['Welder'],
  'Roof Work': ['Mason', 'Helper'],
  'Flooring': ['Mason', 'Helper'],
  'Civil Work': ['Mason', 'Helper'],
  'Finishing': ['Helper'],
  'Other': [],
};

// GET /api/work/building/:buildingId — get works for building with optional period/date filter
router.get('/building/:buildingId', auth, async (req, res) => {
  try {
    const { date, period } = req.query;
    const filter = { buildingId: req.params.buildingId };

    if (date) {
      filter.workDate = date;
    } else if (period) {
      const now = new Date();
      let startDate;
      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'weekly') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (startDate) {
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        filter.workDate = {
          $gte: startDate.toISOString().split('T')[0],
          $lte: endDate.toISOString().split('T')[0],
        };
      }
    }

    const works = await Work.find(filter)
      .populate('assignedEmployeeIds', 'employeeName mobileNumber roleTitle category')
      .populate('createdBy', 'name')
      .sort({ workDate: -1, createdAt: -1 });

    res.json({ works });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/work/building/:buildingId/today-employees — get employees assigned to today's work
router.get('/building/:buildingId/today-employees', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const works = await Work.find({
      buildingId: req.params.buildingId,
      workDate: today,
    }).populate('assignedEmployeeIds', 'employeeName mobileNumber roleTitle category employeeType salaryType salaryAmount');

    const employeeMap = new Map();
    works.forEach((work) => {
      (work.assignedEmployeeIds || []).forEach((emp) => {
        if (emp && !employeeMap.has(emp._id.toString())) {
          employeeMap.set(emp._id.toString(), emp);
        }
      });
    });

    res.json({
      employees: Array.from(employeeMap.values()),
      workCount: works.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/work — create work
router.post('/', auth, async (req, res) => {
  try {
    const { buildingId, workDate, workTypes, otherWorkName, description, assignedEmployeeIds, status } = req.body;

    if (!buildingId || !workDate || !workTypes || workTypes.length === 0) {
      return res.status(400).json({ message: 'buildingId, workDate, and workTypes are required' });
    }

    const work = await Work.create({
      buildingId,
      workDate,
      workTypes,
      otherWorkName: otherWorkName || '',
      description: description || '',
      assignedEmployeeIds: assignedEmployeeIds || [],
      status: status || 'Planned',
      createdBy: req.user._id,
    });

    const populated = await Work.findById(work._id)
      .populate('assignedEmployeeIds', 'employeeName mobileNumber roleTitle category')
      .populate('createdBy', 'name');

    res.status(201).json({ work: populated });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/work/:id — update work
router.put('/:id', auth, async (req, res) => {
  try {
    const { workDate, workTypes, otherWorkName, description, assignedEmployeeIds, status } = req.body;

    const work = await Work.findById(req.params.id);
    if (!work) return res.status(404).json({ message: 'Work not found' });

    if (workDate !== undefined) work.workDate = workDate;
    if (workTypes !== undefined) work.workTypes = workTypes;
    if (otherWorkName !== undefined) work.otherWorkName = otherWorkName;
    if (description !== undefined) work.description = description;
    if (assignedEmployeeIds !== undefined) work.assignedEmployeeIds = assignedEmployeeIds;
    if (status !== undefined) work.status = status;

    await work.save();

    const populated = await Work.findById(work._id)
      .populate('assignedEmployeeIds', 'employeeName mobileNumber roleTitle category')
      .populate('createdBy', 'name');

    res.json({ work: populated });

    updateBuildingToProcessing(work.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/work/:id — delete work
router.delete('/:id', auth, async (req, res) => {
  try {
    const work = await Work.findByIdAndDelete(req.params.id);
    if (!work) return res.status(404).json({ message: 'Work not found' });
    res.json({ message: 'Work deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/work/building/:buildingId/available-employees — get employees filterable by work types
router.get('/building/:buildingId/available-employees', auth, async (req, res) => {
  try {
    const { workTypes } = req.query;
    let roles = [];
    if (workTypes) {
      const types = workTypes.split(',');
      const roleSet = new Set();
      types.forEach((t) => {
        const mapped = WORK_TYPE_ROLES[t.trim()];
        if (mapped) mapped.forEach((r) => roleSet.add(r));
      });
      roles = Array.from(roleSet);
    }

    const filter = { assignedBuildingId: req.params.buildingId, status: 'Active' };
    if (roles.length > 0) {
      filter.category = { $in: roles };
    }

    const employees = await Employee.find(filter)
      .select('employeeName mobileNumber roleTitle category employeeType salaryType salaryAmount')
      .sort({ employeeName: 1 });

    res.json({ employees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
