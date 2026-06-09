const express = require('express');
const Advance = require('../models/Advance');
const Employee = require('../models/Employee');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// GET /api/advance/building/:buildingId
router.get('/building/:buildingId', auth, async (req, res) => {
  try {
    const advances = await Advance.find({ buildingId: req.params.buildingId })
      .populate('employeeId', 'employeeName mobileNumber roleTitle salaryType salaryAmount')
      .sort({ createdAt: -1 });
    res.json({ advances });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/advance
router.post('/', auth, async (req, res) => {
  try {
    const { employeeId, buildingId, amount, remarks, advanceDate } = req.body;

    if (!employeeId || !buildingId || !amount) {
      return res.status(400).json({ message: 'employeeId, buildingId, and amount are required' });
    }

    const advance = new Advance({
      employeeId,
      buildingId,
      amount,
      recoveredAmount: 0,
      pendingAmount: amount,
      remarks: remarks || '',
      advanceDate: advanceDate || new Date().toISOString().split('T')[0],
      createdBy: req.user._id,
    });

    await advance.save();

    const populated = await Advance.findById(advance._id)
      .populate('employeeId', 'employeeName mobileNumber roleTitle salaryType salaryAmount');

    res.json({ advance: populated });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/advance/employee/:employeeId
router.get('/employee/:employeeId', auth, async (req, res) => {
  try {
    const advances = await Advance.find({ employeeId: req.params.employeeId })
      .sort({ createdAt: -1 })
      .populate('employeeId', 'employeeName mobileNumber roleTitle salaryType salaryAmount');
    res.json({ advances });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
