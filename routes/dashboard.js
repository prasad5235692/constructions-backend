const express = require('express');
const Land = require('../models/Land');
const Building = require('../models/Building');
const Employee = require('../models/Employee');
const Vendor = require('../models/Vendor');
const { Material, BuildingMaterialLedger } = require('../models/Material');
const Payment = require('../models/Payment');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard
router.get('/', auth, async (req, res) => {
  try {
    const [
      lands, buildings, employees, vendors,
      materialLedgers, payments,
    ] = await Promise.all([
      Land.find(),
      Building.find(),
      Employee.find(),
      Vendor.find(),
      BuildingMaterialLedger.find(),
      Payment.find(),
    ]);

    const totalLands = lands.length;
    const bookedLands = lands.filter((l) => l.category === 'booked').length;
    const availableLands = lands.filter((l) => l.category === 'booking').length;

    const totalBuildings = buildings.length;
    const ongoingBuildings = buildings.filter((b) => b.category === 'ongoing').length;
    const completedBuildings = buildings.filter((b) => b.category === 'completed').length;

    const totalEmployees = employees.length;
    const totalVendors = vendors.length;

    const totalMaterialCost = materialLedgers.reduce((sum, l) => sum + l.totalCost, 0);

    let totalProjectCost = 0;
    buildings.forEach((b) => {
      totalProjectCost += b.totalExpense || 0;
    });

    // Monthly revenue and expenses
    const monthlyRevenue = {};
    const monthlyExpenses = {};

    payments.forEach((p) => {
      if (!p.dueDate) return;
      const month = p.dueDate.substring(0, 7);
      if (p.status === 'Paid') {
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + p.amount;
      } else {
        monthlyExpenses[month] = (monthlyExpenses[month] || 0) + p.amount;
      }
    });

    // Land statistics
    const landStats = {
      total: totalLands,
      booked: bookedLands,
      available: availableLands,
    };

    // Building progress
    const buildingProgress = buildings.map((b) => ({
      id: b._id,
      name: b.buildingName,
      progress: b.constructionProgress || 0,
      category: b.category,
    }));

    // Employee attendance summary
    const presentCount = employees.filter((e) => e.attendance.todayStatus === 'Present').length;
    const absentCount = employees.filter((e) => e.attendance.todayStatus === 'Absent').length;
    const halfDayCount = employees.filter((e) => e.attendance.todayStatus === 'Half Day').length;

    // Expenses vs Income
    const expenseVsIncome = [];
    const allMonths = new Set([
      ...Object.keys(monthlyRevenue),
      ...Object.keys(monthlyExpenses),
    ]);
    [...allMonths].sort().forEach((month) => {
      expenseVsIncome.push({
        month,
        income: monthlyRevenue[month] || 0,
        expenses: monthlyExpenses[month] || 0,
      });
    });

    res.json({
      totalLands,
      bookedLands,
      availableLands,
      totalBuildings,
      ongoingBuildings,
      completedBuildings,
      totalEmployees,
      totalVendors,
      totalMaterialCost,
      totalProjectCost,
      monthlyRevenue,
      monthlyExpenses,
      landStats,
      buildingProgress,
      employeeAttendance: { present: presentCount, absent: absentCount, halfDay: halfDayCount },
      expenseVsIncome,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
