const express = require('express');
const mongoose = require('mongoose');
const RestockRequest = require('../models/RestockRequest');
const BuildingMaterial = require('../models/BuildingMaterial');
const { auth } = require('../middleware/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

function getUserId(user) {
  return user?._id || user?.id;
}

// POST /api/restock-requests — create a restock request (from Material Screen)
router.post('/', auth, async (req, res) => {
  try {
    const { buildingId, materialId, sourceRecordId, quantity } = req.body;
    if (!buildingId || !materialId || !sourceRecordId || !quantity) {
      return res.status(400).json({ message: 'buildingId, materialId, sourceRecordId, and quantity are required' });
    }

    const source = await BuildingMaterial.findById(sourceRecordId);
    if (!source) return res.status(404).json({ message: 'Source material record not found' });

    const qty = Number(quantity);
    if (qty <= 0) return res.status(400).json({ message: 'Quantity must be greater than zero' });

    const request = await RestockRequest.create({
      buildingId,
      materialId,
      sourceRecordId,
      category: source.category,
      materialName: source.materialName,
      brand: source.brand || '',
      unit: source.unit || '',
      quantity: qty,
      unitRate: source.unitRate || 0,
      totalAmount: qty * (source.unitRate || 0),
      status: 'Pending',
      requestedBy: getUserId(req.user),
      requestedDate: new Date(),
    });

    res.status(201).json({ request });

    updateBuildingToProcessing(buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/restock-requests/building/:buildingId — get pending requests for a building
router.get('/building/:buildingId', auth, async (req, res) => {
  try {
    const requests = await RestockRequest.find({
      buildingId: req.params.buildingId,
      status: 'Pending',
    }).sort({ requestedDate: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/restock-requests/material/:materialId/building/:buildingId — get approved restock history for a material
router.get('/material/:materialId/building/:buildingId', auth, async (req, res) => {
  try {
    const requests = await RestockRequest.find({
      buildingId: req.params.buildingId,
      materialId: req.params.materialId,
      status: 'Approved',
    }).sort({ approvedAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/restock-requests/:id/approve — approve a restock request
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const request = await RestockRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Restock request not found' });
    if (request.status !== 'Pending') return res.status(400).json({ message: 'Request is already ' + request.status });

    request.status = 'Approved';
    request.approvedAt = new Date();
    request.approvedBy = getUserId(req.user);
    await request.save();

    // Update the source material record only — no duplicate entry created
    const source = await BuildingMaterial.findById(request.sourceRecordId);
    if (source) {
      source.restockedQuantity = (source.restockedQuantity || 0) + request.quantity;
      source.quantity = (source.initialQuantity || 0) + source.restockedQuantity;
      source.totalAmount = source.quantity * source.unitRate;
      source.paymentStatus = 'Restocked';
      await source.save();
    }

    res.json({ request, material: source });

    updateBuildingToProcessing(request.buildingId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
