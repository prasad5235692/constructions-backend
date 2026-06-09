const express = require('express');
const mongoose = require('mongoose');
const MaterialUsage = require('../models/MaterialUsage');
const BuildingMaterial = require('../models/BuildingMaterial');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// POST /api/material-usage/log
router.post('/log', auth, async (req, res) => {
  try {
    const { buildingId, materialId, unit, qty, time } = req.body;

    if (!buildingId || !materialId || qty === undefined || Number(qty) <= 0) {
      return res.status(400).json({ message: 'buildingId, materialId, and qty (>0) are required' });
    }

    const usageQty = Number(qty);
    const today = new Date().toISOString().split('T')[0];

    // Fetch building material to validate stock
    const buildingMat = await BuildingMaterial.findOne({ buildingId, materialId });
    if (!buildingMat) {
      return res.status(404).json({ message: 'Building material record not found' });
    }

    const available = (buildingMat.quantity || 0) - (buildingMat.usedQuantity || 0);
    if (usageQty > available) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${Math.max(0, available)} ${unit || buildingMat.unit || 'units'}`,
      });
    }

    // UPSERT: find existing record for same day
    let usageRecord = await MaterialUsage.findOne({
      buildingId,
      materialId,
      date: today,
    });

    if (usageRecord) {
      // Same day — ADD to existing values
      usageRecord.usedQuantity += usageQty;
      usageRecord.history.push({ time: time || new Date().toLocaleTimeString(), qty: usageQty });
      await usageRecord.save();
    } else {
      // New day — create fresh record
      usageRecord = await MaterialUsage.create({
        buildingId,
        materialId,
        date: today,
        usedQuantity: usageQty,
        unit: unit || buildingMat.unit || '',
        history: [{ time: time || new Date().toLocaleTimeString(), qty: usageQty }],
      });
    }

    // Update cached total on BuildingMaterial
    buildingMat.usedQuantity = (buildingMat.usedQuantity || 0) + usageQty;
    await buildingMat.save();

    res.json({ usageRecord, buildingMaterial: buildingMat });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/material-usage/:buildingId/:materialId
router.get('/:buildingId/:materialId', auth, async (req, res) => {
  try {
    const { buildingId, materialId } = req.params;

    const records = await MaterialUsage.find({ buildingId, materialId })
      .sort({ date: -1 })
      .lean();

    const totalUsed = records.reduce((sum, r) => sum + (r.usedQuantity || 0), 0);

    res.json({ records, totalUsed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
