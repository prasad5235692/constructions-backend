const express = require('express');
const mongoose = require('mongoose');
const BuildingMaterial = require('../models/BuildingMaterial');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

function getUserId(user) {
  return user?._id || user?.id;
}

// GET /api/building-materials/:buildingId
router.get('/:buildingId', auth, async (req, res) => {
  try {
    const materials = await BuildingMaterial.find({
      buildingId: req.params.buildingId,
    }).sort({ category: 1, materialName: 1 });

    res.json({ materials });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/building-materials/:buildingId/bulk-add
router.post('/:buildingId/bulk-add', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    const buildingId = req.params.buildingId;
    const userId = getUserId(req.user);

    const created = [];

    for (const item of items) {
      const { materialId, category, materialName, unit, quantity, unitRate, brand, vendorName, vendorPhone, vendorAddress, billNumber } = item;

      if (!materialId || !quantity || !unitRate) {
        return res.status(400).json({ message: 'materialId, quantity, and unitRate are required for each item' });
      }

      const totalAmount = Number(quantity) * Number(unitRate);

      const qty = Number(quantity);
      const record = await BuildingMaterial.create({
        buildingId,
        materialId,
        category,
        materialName,
        brand: brand || '',
        unit,
        vendorName: vendorName || '',
        vendorPhone: vendorPhone || '',
        vendorAddress: vendorAddress || '',
        billNumber: billNumber || '',
        quantity: qty,
        initialQuantity: qty,
        restockedQuantity: 0,
        usedQuantity: 0,
        unitRate: Number(unitRate),
        totalAmount,
        addedDate: new Date(),
        createdBy: userId,
      });

      created.push(record);
    }

    res.status(201).json({ materials: created });

    updateBuildingToProcessing(req.params.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/building-materials/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { quantity, usedQuantity, unitRate, vendorName, vendorPhone, vendorAddress, billNumber, brand } = req.body;
    const record = await BuildingMaterial.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (quantity !== undefined) record.quantity = Number(quantity);
    if (usedQuantity !== undefined) {
      const newUsed = Number(usedQuantity);
      if (newUsed > record.quantity) {
        return res.status(400).json({ message: 'Used quantity cannot exceed total quantity' });
      }
      record.usedQuantity = newUsed;
    }
    if (unitRate !== undefined) record.unitRate = Number(unitRate);
    if (vendorName !== undefined) record.vendorName = vendorName;
    if (vendorPhone !== undefined) record.vendorPhone = vendorPhone;
    if (vendorAddress !== undefined) record.vendorAddress = vendorAddress;
    if (billNumber !== undefined) record.billNumber = billNumber;
    if (brand !== undefined) record.brand = brand;
    record.totalAmount = record.quantity * record.unitRate;

    await record.save();
    res.json({ material: record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/building-materials/transfer
router.post('/transfer', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { fromBuildingId, toBuildingId, materialId, quantity } = req.body;

    if (!fromBuildingId || !toBuildingId || !materialId || !quantity) {
      return res.status(400).json({ message: 'fromBuildingId, toBuildingId, materialId, and quantity are required' });
    }

    const transferQty = Number(quantity);
    if (transferQty <= 0) {
      return res.status(400).json({ message: 'Transfer quantity must be greater than zero' });
    }

    // Find source record
    const sourceRecord = await BuildingMaterial.findOne({
      buildingId: fromBuildingId,
      materialId,
    }).session(session);

    if (!sourceRecord) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Source material not found' });
    }

    const available = (sourceRecord.quantity || 0) - (sourceRecord.usedQuantity || 0);
    if (transferQty > available) {
      await session.abortTransaction();
      return res.status(400).json({ message: `Insufficient stock. Available: ${available} ${sourceRecord.unit}` });
    }

    // Deduct from source
    sourceRecord.quantity -= transferQty;
    sourceRecord.totalAmount = sourceRecord.quantity * sourceRecord.unitRate;
    await sourceRecord.save({ session });

    // Add to target - find or create
    let targetRecord = await BuildingMaterial.findOne({
      buildingId: toBuildingId,
      materialId,
    }).session(session);

    if (targetRecord) {
      targetRecord.quantity += transferQty;
      targetRecord.totalAmount = targetRecord.quantity * targetRecord.unitRate;
      await targetRecord.save({ session });
    } else {
      targetRecord = await BuildingMaterial.create([{
        buildingId: toBuildingId,
        materialId,
        category: sourceRecord.category,
        materialName: sourceRecord.materialName,
        unit: sourceRecord.unit,
        quantity: transferQty,
        usedQuantity: 0,
        unitRate: sourceRecord.unitRate,
        totalAmount: transferQty * sourceRecord.unitRate,
        addedDate: new Date(),
        createdBy: getUserId(req.user),
      }], { session });
    }

    await session.commitTransaction();

    const updated = await BuildingMaterial.find({ buildingId: fromBuildingId }).sort({ category: 1, materialName: 1 });

    res.json({
      message: 'Transfer successful',
      sourceUpdated: sourceRecord,
      targetCreated: targetRecord,
      remainingStock: updated,
    });

    updateBuildingToProcessing(fromBuildingId);
    updateBuildingToProcessing(toBuildingId);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// POST /api/building-materials/:id/restock
router.post('/:id/restock', auth, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid restock quantity is required' });
    }

    const record = await BuildingMaterial.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    record.quantity += Number(quantity);
    record.totalAmount = record.quantity * record.unitRate;

    await record.save();
    res.json({ material: record });

    updateBuildingToProcessing(record.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/building-materials/:id/use
router.post('/:id/use', auth, async (req, res) => {
  try {
    const { used } = req.body;
    if (!used || Number(used) <= 0) {
      return res.status(400).json({ message: 'Valid usage quantity is required' });
    }

    const record = await BuildingMaterial.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const usageQty = Number(used);
    const today = new Date().toISOString().split('T')[0];
    const currentAvailable = (record.quantity || 0) - (record.usedQuantity || 0);

    if (usageQty > currentAvailable) {
      return res.status(400).json({
        message: `Not enough stock available. Only ${currentAvailable} ${record.unit || 'units'} remaining.`,
      });
    }

    // Find existing daily record
    const existing = record.usageHistory.find((u) => u.date === today);

    if (existing) {
      existing.totalUsed += usageQty;
      existing.availableStock = existing.openingStock - existing.totalUsed;
      existing.lastUpdated = new Date();
    } else {
      record.usageHistory.push({
        date: today,
        totalUsed: usageQty,
        openingStock: currentAvailable,
        availableStock: currentAvailable - usageQty,
        lastUpdated: new Date(),
      });
    }

    record.usedQuantity = (record.usedQuantity || 0) + usageQty;
    await record.save();

    res.json({ material: record });

    updateBuildingToProcessing(record.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/building-materials/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const record = await BuildingMaterial.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/building-materials/:id/payment
router.patch('/:id/payment', auth, async (req, res) => {
  try {
    const { paymentType, amount, date, remarks } = req.body;
    if (!paymentType || amount === undefined) {
      return res.status(400).json({ message: 'Payment type and amount required' });
    }
    if (!['Advance', 'Due', 'Final'].includes(paymentType)) {
      return res.status(400).json({ message: 'Invalid payment type' });
    }

    const record = await BuildingMaterial.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const amt = Number(amount);
    if (amt <= 0) return res.status(400).json({ message: 'Amount must be greater than zero' });

    if (paymentType === 'Advance') {
      record.advancePaid = (record.advancePaid || 0) + amt;
      record.paymentStatus = 'Advance Paid';
    } else if (paymentType === 'Due') {
      record.duePaid = (record.duePaid || 0) + amt;
      if (record.paymentStatus === 'Pending' || record.paymentStatus === 'Advance Paid') {
        record.paymentStatus = 'Partially Paid';
      }
    } else if (paymentType === 'Final') {
      record.finalPaid = (record.finalPaid || 0) + amt;
      const totalPaid = (record.advancePaid || 0) + (record.duePaid || 0) + (record.finalPaid || 0);
      record.paymentStatus = totalPaid >= record.totalAmount ? 'Fully Paid' : 'Partially Paid';
    }

    record.paymentHistory.push({
      type: paymentType,
      amount: amt,
      date: date || new Date().toISOString(),
      remarks: remarks || '',
    });

    await record.save();
    res.json({ material: record });

    updateBuildingToProcessing(record.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
