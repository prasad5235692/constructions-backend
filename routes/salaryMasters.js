const express = require('express');
const SalaryMaster = require('../models/SalaryMaster');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const salaryMasters = await SalaryMaster.find().sort({ role: 1 });
    res.json({ salaryMasters });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/role/:role', auth, async (req, res) => {
  try {
    const salaryMaster = await SalaryMaster.findOne({ role: req.params.role });
    if (!salaryMaster) return res.status(404).json({ message: 'Role not found' });
    res.json({ salaryMaster });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { role, salaryType, salaryAmount } = req.body;
    const existing = await SalaryMaster.findOne({ role });
    if (existing) {
      return res.status(400).json({ message: 'Salary master for this role already exists' });
    }
    const salaryMaster = await SalaryMaster.create({ role, salaryType, salaryAmount });
    res.status(201).json({ salaryMaster });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const salaryMaster = await SalaryMaster.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!salaryMaster) return res.status(404).json({ message: 'Not found' });
    res.json({ salaryMaster });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const salaryMaster = await SalaryMaster.findByIdAndDelete(req.params.id);
    if (!salaryMaster) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
