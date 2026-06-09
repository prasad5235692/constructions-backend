const express = require('express');
const mongoose = require('mongoose');
const CompanyExpense = require('../models/CompanyExpense');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router({ mergeParams: true });

const PREDEFINED_EXPENSES = [
  { category: 'Land Cleaning', expenseName: 'JCB Rent', isRental: true },
  { category: 'Land Cleaning', expenseName: 'Poclain Rent', isRental: true },
  { category: 'Land Cleaning', expenseName: 'Tractor Rent', isRental: true },
  { category: 'Land Cleaning', expenseName: 'Dumper / Lorry Rent', isRental: true },
  { category: 'Land Cleaning', expenseName: 'Bush Cleaning', isRental: false },
  { category: 'Land Cleaning', expenseName: 'Tree Cutting', isRental: false },
  { category: 'Land Cleaning', expenseName: 'Debris Removal', isRental: false },
  { category: 'Land Cleaning', expenseName: 'Leveling Work', isRental: false },
  { category: 'Land Cleaning', expenseName: 'Borewell Cleaning', isRental: false },

  { category: 'Site Visit Expenses', expenseName: 'Bike Petrol', isRental: false },
  { category: 'Site Visit Expenses', expenseName: 'Car Diesel / Petrol', isRental: false },
  { category: 'Site Visit Expenses', expenseName: 'Toll Charges', isRental: false },
  { category: 'Site Visit Expenses', expenseName: 'Food Expenses', isRental: false },

  { category: 'Material Transportation', expenseName: 'Sand Lorry Transport', isRental: false },
  { category: 'Material Transportation', expenseName: 'Blue Metal Transport', isRental: false },
  { category: 'Material Transportation', expenseName: 'Brick Transport', isRental: false },
  { category: 'Material Transportation', expenseName: 'Cement Loading / Unloading', isRental: false },
  { category: 'Material Transportation', expenseName: 'Steel Transport', isRental: false },
  { category: 'Material Transportation', expenseName: 'Material Shifting Charges', isRental: false },

  { category: 'Machinery Expenses', expenseName: 'JCB Rental', isRental: true },
  { category: 'Machinery Expenses', expenseName: 'Concrete Mixer Rental', isRental: true },
  { category: 'Machinery Expenses', expenseName: 'Vibrator Machine Rental', isRental: true },
  { category: 'Machinery Expenses', expenseName: 'Water Motor Rental', isRental: true },
  { category: 'Machinery Expenses', expenseName: 'Generator Rental', isRental: true },
  { category: 'Machinery Expenses', expenseName: 'Cutting Machine Rental', isRental: true },
  { category: 'Machinery Expenses', expenseName: 'Scaffolding Rental', isRental: true },
];

function getUserId(user) {
  return user?._id || user?.id;
}

async function ensureExpensesExist(buildingId, userId) {
  const existing = await CompanyExpense.find({ buildingId }).lean();
  const existingKeys = new Set(existing.map((e) => `${e.category}::${e.expenseName}`));

  const toCreate = [];
  for (const def of PREDEFINED_EXPENSES) {
    const key = `${def.category}::${def.expenseName}`;
    if (!existingKeys.has(key)) {
      toCreate.push({
        buildingId,
        expenseName: def.expenseName,
        category: def.category,
        isRental: def.isRental,
        enabled: false,
        hours: 0,
        amount: 0,
        enteredBy: userId || undefined,
        enteredDate: new Date(),
      });
    }
  }

  if (toCreate.length > 0) {
    try {
      await CompanyExpense.insertMany(toCreate, { ordered: false });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  return CompanyExpense.find({ buildingId }).sort({ category: 1, expenseName: 1 });
}

// GET /api/buildings/:buildingId/company-expenses
router.get('/', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }

    const expenses = await ensureExpensesExist(buildingId, getUserId(req.user));

    const categoryTotals = {};
    let grandTotal = 0;

    for (const exp of expenses) {
      if (exp.enabled && exp.amount > 0) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        grandTotal += exp.amount;
      }
    }

    res.json({ expenses, categoryTotals, grandTotal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/buildings/:buildingId/company-expenses
router.post('/', auth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { expenseName, category, enabled, hours, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({ message: 'Invalid building ID' });
    }
    if (!expenseName || !category) {
      return res.status(400).json({ message: 'expenseName and category are required' });
    }

    let expense = await CompanyExpense.findOne({ buildingId, category, expenseName });

    if (expense) {
      if (enabled !== undefined) expense.enabled = enabled;
      if (hours !== undefined) expense.hours = Number(hours) || 0;
      if (amount !== undefined) expense.amount = Number(amount) || 0;
      expense.enteredBy = getUserId(req.user);
      expense.enteredDate = new Date();
      await expense.save();
    } else {
      const def = PREDEFINED_EXPENSES.find((e) => e.category === category && e.expenseName === expenseName);
      expense = await CompanyExpense.create({
        buildingId,
        expenseName,
        category,
        isRental: def?.isRental || false,
        enabled: enabled || false,
        hours: Number(hours) || 0,
        amount: Number(amount) || 0,
        enteredBy: getUserId(req.user),
        enteredDate: new Date(),
      });
    }

    res.json({ expense });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Expense record already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/buildings/:buildingId/company-expenses/:expenseId
router.patch('/:expenseId', auth, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { enabled, hours, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ message: 'Invalid expense ID' });
    }

    const expense = await CompanyExpense.findById(expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (enabled !== undefined) expense.enabled = enabled;
    if (hours !== undefined) expense.hours = Number(hours) || 0;
    if (amount !== undefined) expense.amount = Number(amount) || 0;
    expense.enteredBy = getUserId(req.user);
    expense.enteredDate = new Date();
    await expense.save();

    res.json({ expense });

    updateBuildingToProcessing(req.params.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/buildings/:buildingId/company-expenses/:expenseId
router.delete('/:expenseId', auth, async (req, res) => {
  try {
    const { expenseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ message: 'Invalid expense ID' });
    }

    const expense = await CompanyExpense.findByIdAndDelete(expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
