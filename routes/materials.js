const express = require('express');
const { Material, BuildingMaterialLedger } = require('../models/Material');
const Building = require('../models/Building');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validation');

const router = express.Router();

async function syncBuildingMaterialSummary(buildingId) {
  const ledgers = await BuildingMaterialLedger.find({ buildingId });

  const purchased = ledgers.reduce((sum, ledger) => sum + (ledger.totalCost || 0), 0);
  const used = ledgers.reduce((sum, ledger) => sum + (ledger.usedCost || 0), 0);
  const pending = Math.max(0, purchased - used);

  await Building.findByIdAndUpdate(buildingId, {
    materialsSummary: {
      purchased,
      used,
      pending,
    },
  });
}

// === MASTER MATERIALS ===

// GET /api/materials
router.get('/', auth, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isMaster: true };
    if (category) filter.category = category;

    const materials = await Material.find(filter).sort({ materialName: 1 });
    res.json({ materials });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/materials/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json({ material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/materials
router.post('/', auth, async (req, res) => {
  try {
    if (!isNonEmptyString(req.body.materialName)) {
      return res.status(400).json({ message: 'Material name required' });
    }

    const material = await Material.create({
      materialName: req.body.materialName.trim(),
      category: req.body.category || 'Other',
      subCategory: req.body.subCategory || '',
      brand: req.body.brand || '',
      company: req.body.company || '',
      size: req.body.size || '',
      unit: req.body.unit || '',
      rate: req.body.rate || 0,
      isMaster: true,
    });

    await createAuditLog({
      module: 'materials',
      action: 'create-material',
      entityType: 'Material',
      entityId: material._id,
      user: req.user,
      description: `Created material ${material.materialName}`,
    });

    res.status(201).json({ material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/materials/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.materialName !== undefined && !isNonEmptyString(req.body.materialName)) {
      return res.status(400).json({ message: 'Material name cannot be empty' });
    }

    const allowedFields = [
      'materialName', 'category', 'subCategory', 'brand',
      'company', 'size', 'unit',
    ];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    if (req.body.rate !== undefined && Number(req.body.rate) !== material.rate) {
      const oldRate = material.rate;
      material.previousRate = oldRate;
      material.rate = Number(req.body.rate);
      material.rateUpdatedAt = new Date();
      material.rateHistory.push({
        rate: oldRate,
        updatedAt: new Date(),
        updatedBy: req.user?.name || req.user?.email || 'system',
      });
    }

    for (const [key, val] of Object.entries(update)) {
      material[key] = val;
    }

    await material.save();

    await createAuditLog({
      module: 'materials',
      action: 'update-material',
      entityType: 'Material',
      entityId: material._id,
      user: req.user,
      description: `Updated material ${material.materialName}`,
      changes: { ...update, rate: req.body.rate },
    });

    res.json({ material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/materials/:id/rate
router.patch('/:id/rate', auth, async (req, res) => {
  try {
    const { rate, reason } = req.body;
    if (rate === undefined || rate === null) {
      return res.status(400).json({ message: 'Rate is required' });
    }

    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    const newRate = Number(rate);
    if (isNaN(newRate)) {
      return res.status(400).json({ message: 'Invalid rate value' });
    }

    const oldRate = material.rate;
    material.previousRate = oldRate;
    material.rate = newRate;
    material.rateUpdatedAt = new Date();
    material.rateHistory.push({
      rate: oldRate,
      updatedAt: new Date(),
      updatedBy: req.user?.name || req.user?.email || 'system',
    });

    await material.save();

    await createAuditLog({
      module: 'materials',
      action: 'update-rate',
      entityType: 'Material',
      entityId: material._id,
      user: req.user,
      description: `Updated rate for ${material.materialName}: ${oldRate} → ${newRate}${reason ? ` (${reason})` : ''}`,
      changes: { previousRate: oldRate, rate: newRate, reason: reason || '' },
    });

    res.json({ material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await BuildingMaterialLedger.deleteMany({ materialId: req.params.id });
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    await createAuditLog({
      module: 'materials',
      action: 'delete-material',
      entityType: 'Material',
      entityId: material._id,
      user: req.user,
      description: `Deleted material ${material.materialName}`,
    });

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === BUILDING MATERIAL LEDGER ===

// GET /api/materials/ledger/:buildingId
router.get('/ledger/:buildingId', auth, async (req, res) => {
  try {
    const ledger = await BuildingMaterialLedger.find({
      buildingId: req.params.buildingId,
    }).populate('materialId', 'materialName category brand unit');

    res.json({ ledger });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/materials/ledger/:buildingId
router.post('/ledger/:buildingId', auth, async (req, res) => {
  try {
    const { materialId, quantity, rate, note } = req.body;
    if (!materialId || !quantity) {
      return res.status(400).json({ message: 'Material ID and quantity required' });
    }

    if (Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than zero' });
    }

    const material = await Material.findById(materialId);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    const building = await Building.findById(req.params.buildingId);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    let ledger = await BuildingMaterialLedger.findOne({
      buildingId: req.params.buildingId,
      materialId,
    });

    if (!ledger) {
      ledger = await BuildingMaterialLedger.create({
        buildingId: req.params.buildingId,
        materialId,
        materialName: material.materialName,
        category: req.body.category || material.category || '',
        brand: material.brand,
        unit: material.unit,
        vendorName: req.body.vendorName || '',
        vendorPhone: req.body.vendorPhone || '',
        rateOverride: rate || material.rate,
      });
    }

    const effectiveRate = rate || ledger.rateOverride || material.rate;
    const amount = quantity * effectiveRate;

    ledger.quantityAdded += quantity;
    ledger.quantityRemaining += quantity;
    ledger.totalCost += amount;

    ledger.transactions.push({
      type: 'add',
      quantity,
      rate: effectiveRate,
      amount,
      date: req.body.date || new Date().toISOString(),
      note: note || '',
    });

    await ledger.save();

    await syncBuildingMaterialSummary(req.params.buildingId);

    await createAuditLog({
      module: 'materials',
      action: 'add-ledger-material',
      entityType: 'BuildingMaterialLedger',
      entityId: ledger._id,
      user: req.user,
      description: `Added ${quantity} ${ledger.unit} of ${ledger.materialName} to ${building.buildingName}`,
      metadata: { buildingId: req.params.buildingId, materialId },
    });

    res.status(201).json({ ledger });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/materials/ledger/:buildingId/:materialId/use
router.put('/ledger/:buildingId/:materialId/use', auth, async (req, res) => {
  try {
    const { quantity, note } = req.body;
    if (!quantity) return res.status(400).json({ message: 'Quantity required' });

    if (Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than zero' });
    }

    const ledger = await BuildingMaterialLedger.findOne({
      buildingId: req.params.buildingId,
      materialId: req.params.materialId,
    });

    if (!ledger) return res.status(404).json({ message: 'Ledger entry not found' });
    if (ledger.quantityRemaining < quantity) {
      return res.status(400).json({ message: 'Insufficient quantity remaining' });
    }

    const building = await Building.findById(req.params.buildingId);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    const effectiveRate = ledger.rateOverride || 0;
    const amount = quantity * effectiveRate;

    ledger.quantityUsed += quantity;
    ledger.quantityRemaining -= quantity;
    ledger.usedCost += amount;

    ledger.transactions.push({
      type: 'use',
      quantity,
      rate: effectiveRate,
      amount,
      date: req.body.date || new Date().toISOString(),
      note: note || '',
    });

    await ledger.save();

    await syncBuildingMaterialSummary(req.params.buildingId);

    await createAuditLog({
      module: 'materials',
      action: 'use-ledger-material',
      entityType: 'BuildingMaterialLedger',
      entityId: ledger._id,
      user: req.user,
      description: `Used ${quantity} ${ledger.unit} of ${ledger.materialName} in ${building.buildingName}`,
      metadata: { buildingId: req.params.buildingId, materialId: req.params.materialId, note: note || '' },
    });

    res.json({ ledger });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/materials/ledger/:buildingId/:materialId/payment
router.patch('/ledger/:buildingId/:materialId/payment', auth, async (req, res) => {
  try {
    const { paymentType, amount, date, remarks } = req.body;
    if (!paymentType || !amount) {
      return res.status(400).json({ message: 'Payment type and amount required' });
    }
    if (!['Advance', 'Due', 'Final'].includes(paymentType)) {
      return res.status(400).json({ message: 'Invalid payment type. Must be Advance, Due, or Final' });
    }

    const ledger = await BuildingMaterialLedger.findOne({
      buildingId: req.params.buildingId,
      materialId: req.params.materialId,
    });

    if (!ledger) return res.status(404).json({ message: 'Ledger entry not found' });

    const amt = Number(amount);
    if (amt <= 0) return res.status(400).json({ message: 'Amount must be greater than zero' });

    const remaining = ledger.totalCost - (ledger.advancePaid + ledger.duePaid + ledger.finalPaid);

    if (paymentType === 'Advance') {
      ledger.advancePaid += amt;
      ledger.paymentStatus = 'Advance Paid';
    } else if (paymentType === 'Due') {
      ledger.duePaid += amt;
      if (ledger.paymentStatus === 'Advance Paid' || ledger.paymentStatus === 'Pending') {
        ledger.paymentStatus = 'Partially Paid';
      }
    } else if (paymentType === 'Final') {
      ledger.finalPaid += amt;
      const totalPaid = ledger.advancePaid + ledger.duePaid + ledger.finalPaid;
      if (totalPaid >= ledger.totalCost) {
        ledger.paymentStatus = 'Fully Paid';
      } else {
        ledger.paymentStatus = 'Partially Paid';
      }
    }

    ledger.paymentHistory.push({
      type: paymentType,
      amount: amt,
      date: date || new Date().toISOString(),
      remarks: remarks || '',
    });

    await ledger.save();

    await createAuditLog({
      module: 'materials',
      action: 'material-payment',
      entityType: 'BuildingMaterialLedger',
      entityId: ledger._id,
      user: req.user,
      description: `${paymentType} payment of ${amt} recorded for ${ledger.materialName}`,
      metadata: { buildingId: req.params.buildingId, materialId: req.params.materialId, paymentType, amount: amt },
    });

    res.json({ ledger });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
