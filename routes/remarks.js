const express = require('express');
const Remark = require('../models/Remark');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isMasterAdmin } = require('../utils/auth');
const { updateBuildingToProcessing } = require('../utils/buildingHelpers');

const router = express.Router();

// GET /api/remarks
router.get('/', auth, async (req, res) => {
  try {
    const { module, referenceId } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (referenceId) filter.referenceId = referenceId;

    const remarks = await Remark.find(filter)
      .populate('authorId', 'name role')
      .sort({ createdAt: -1 });

    res.json({ remarks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/remarks
router.post('/', auth, async (req, res) => {
  try {
    const { module, referenceId, text } = req.body;
    if (!module || !referenceId || !text) {
      return res.status(400).json({ message: 'Module, referenceId, and text required' });
    }

    const remark = await Remark.create({
      module,
      referenceId,
      authorId: req.user._id,
      authorRole: req.user.role,
      authorName: req.user.name,
      date: new Date().toISOString(),
      text,
    });

    const populated = await Remark.findById(remark._id)
      .populate('authorId', 'name role');

    await createAuditLog({
      module: 'remarks',
      action: 'create-remark',
      entityType: 'Remark',
      entityId: remark._id,
      user: req.user,
      description: `Created remark in ${module}`,
      metadata: { referenceId },
    });

    res.status(201).json({ remark: populated });

    if (module === 'buildings') updateBuildingToProcessing(referenceId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/remarks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const remark = await Remark.findById(req.params.id);
    if (!remark) return res.status(404).json({ message: 'Remark not found' });

    // Only author or master admin can delete
    if (remark.authorId.toString() !== req.user._id.toString() && !isMasterAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to delete this remark' });
    }

    await Remark.findByIdAndDelete(req.params.id);

    await createAuditLog({
      module: 'remarks',
      action: 'delete-remark',
      entityType: 'Remark',
      entityId: remark._id,
      user: req.user,
      description: `Deleted remark ${remark._id}`,
      metadata: { module: remark.module, referenceId: remark.referenceId },
    });

    res.json({ message: 'Remark deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
