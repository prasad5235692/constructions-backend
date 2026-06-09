const express = require('express');
const Land = require('../models/Land');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validation');

const router = express.Router();

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function cloneValue(value) {
  if (value === undefined) {
    return null;
  }

  const source = value && typeof value.toObject === 'function' ? value.toObject() : value;
  return JSON.parse(JSON.stringify(source === undefined ? null : source));
}

function valuesMatch(left, right) {
  return JSON.stringify(cloneValue(left)) === JSON.stringify(cloneValue(right));
}

function trackChange(changes, section, field, oldValue, newValue) {
  if (valuesMatch(oldValue, newValue)) {
    return;
  }

  changes.push({
    section,
    field,
    oldValue: cloneValue(oldValue),
    newValue: cloneValue(newValue),
  });
}

function appendHistoryEntries(land, changes, user) {
  if (!changes.length) {
    return;
  }

  const updatedBy = user?.name || user?.email || 'System';
  const updatedDate = new Date().toISOString();

  land.history.push(...changes.map((change) => ({
    section: change.section,
    field: change.field,
    oldValue: change.oldValue,
    newValue: change.newValue,
    updatedBy,
    updatedDate,
  })));
}

router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const lands = await Land.find(filter).sort({ createdAt: -1 });
    res.json({ lands });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    res.json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    if (!isNonEmptyString(req.body.landName)) {
      return res.status(400).json({ message: 'Land name required' });
    }

    if (!isNonEmptyString(req.body.partyName)) {
      return res.status(400).json({ message: 'Party name required' });
    }

    if (!isNonEmptyString(req.body.landArea)) {
      return res.status(400).json({ message: 'Land area required' });
    }

    if (!isPositiveNumber(req.body.totalAmount)) {
      return res.status(400).json({ message: 'Total amount must be greater than zero' });
    }

    if (!isNonEmptyString(req.body.createdDate)) {
      return res.status(400).json({ message: 'Created date required' });
    }

    if (req.body.advanceAvailable === 'Yes' && !isPositiveNumber(req.body.advanceAmount)) {
      return res.status(400).json({ message: 'Advance amount required when advance is available' });
    }

    const createdDate = req.body.createdDate.trim();
    const initialAdvanceAmount = Number(req.body.advanceAmount) || 0;
    const hasInitialAdvance = req.body.advanceAvailable === 'Yes' && initialAdvanceAmount > 0;

    const land = await Land.create({
      landName: req.body.landName.trim(),
      partyName: req.body.partyName.trim(),
      mobile: req.body.mobile || '',
      address: req.body.address || '',
      landArea: req.body.landArea.trim(),
      totalAmount: Number(req.body.totalAmount) || 0,
      advanceAvailable: req.body.advanceAvailable || 'No',
      advanceAmount: hasInitialAdvance ? initialAdvanceAmount : 0,
      createdDate,
      advances: hasInitialAdvance
        ? [{ amount: initialAdvanceAmount, date: createdDate, remarks: 'Initial advance' }]
        : [],
    });

    await createAuditLog({
      module: 'lands',
      action: 'create-land',
      entityType: 'Land',
      entityId: land._id,
      user: req.user,
      description: `Created land ${land.landName}`,
    });

    res.status(201).json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.landName !== undefined && !isNonEmptyString(req.body.landName)) {
      return res.status(400).json({ message: 'Land name cannot be empty' });
    }

    if (req.body.partyName !== undefined && !isNonEmptyString(req.body.partyName)) {
      return res.status(400).json({ message: 'Party name cannot be empty' });
    }

    if (req.body.landArea !== undefined && !isNonEmptyString(req.body.landArea)) {
      return res.status(400).json({ message: 'Land area cannot be empty' });
    }

    if (req.body.createdDate !== undefined && !isNonEmptyString(req.body.createdDate)) {
      return res.status(400).json({ message: 'Created date cannot be empty' });
    }

    if (req.body.totalAmount !== undefined && !isPositiveNumber(req.body.totalAmount)) {
      return res.status(400).json({ message: 'Total amount must be greater than zero' });
    }

    if (req.body.advanceAvailable !== undefined && !['Yes', 'No'].includes(req.body.advanceAvailable)) {
      return res.status(400).json({ message: 'Advance available must be Yes or No' });
    }

    if (
      req.body.advanceAmount !== undefined
      && (req.body.advanceAvailable === 'Yes' || (req.body.advanceAvailable === undefined && req.body.advanceAmount !== 0))
      && Number(req.body.advanceAmount) < 0
    ) {
      return res.status(400).json({ message: 'Advance amount cannot be negative' });
    }

    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    const changes = [];

    const allowedTopFields = [
      'landName', 'partyName', 'mobile', 'address', 'landArea',
      'totalAmount', 'advanceAvailable', 'advanceAmount', 'createdDate',
    ];

    for (const field of allowedTopFields) {
      if (req.body[field] !== undefined) {
        trackChange(changes, 'summary', field, land[field], req.body[field]);
        land[field] = req.body[field];
      }
    }

    const nestedSections = [
      'document', 'previousDocument', 'legalOpinion', 'registration',
      'brokerCommission', 'approvals', 'cleaning', 'survey', 'fieldWork',
      'roadWork', 'ebWork', 'compound', 'plotStone', 'advertisement',
    ];

    if (req.body.approvals) {
      const approvals = req.body.approvals;
      for (const key of ['dtcp', 'localBodies', 'rera']) {
        const item = approvals[key];
        if (item && item.status === 'Completed') {
          if (item.amount === undefined || item.amount === '' || item.amount === 0) {
            return res.status(400).json({ message: `${key} approval: Amount is required when status is Completed` });
          }
          if (!item.approvedDate || !item.approvedDate.trim()) {
            return res.status(400).json({ message: `${key} approval: Approval date is required when status is Completed` });
          }
          if (!item.approvedTime || !item.approvedTime.trim()) {
            return res.status(400).json({ message: `${key} approval: Approval time is required when status is Completed` });
          }
        }
      }
    }

    for (const section of nestedSections) {
      if (req.body[section] !== undefined) {
        trackChange(changes, section, section, land[section], req.body[section]);
        land.set(section, req.body[section]);
      }
    }

    if (req.body.advances !== undefined) {
      trackChange(changes, 'party', 'advances', land.advances, req.body.advances);
      land.advances = req.body.advances;
    }

    if (req.body.sales !== undefined) {
      trackChange(changes, 'sales', 'sales', land.sales, req.body.sales);
      land.sales = req.body.sales;
    }

    appendHistoryEntries(land, changes, req.user);

    await land.save();

    await createAuditLog({
      module: 'lands',
      action: 'update-land',
      entityType: 'Land',
      entityId: land._id,
      user: req.user,
      description: `Updated land ${land.landName}`,
      changes,
      metadata: { updatedFields: Object.keys(req.body) },
    });

    res.json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const land = await Land.findByIdAndDelete(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });

    await createAuditLog({
      module: 'lands',
      action: 'delete-land',
      entityType: 'Land',
      entityId: land._id,
      user: req.user,
      description: `Deleted land ${land.landName}`,
    });

    res.json({ message: 'Land deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const updateSubdoc = (parent, arrayName, idField, body, res) => {
  try {
    const item = parent[arrayName].id(body[idField]);
    if (!item) return res.status(404).json({ message: `${arrayName} entry not found` });
    Object.assign(item, body);
    return null;
  } catch (error) {
    return error;
  }
};

router.post('/:id/advances', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    land.advances.push({ amount: req.body.amount || 0, date: req.body.date || '', remarks: req.body.remarks || '' });
    await land.save();
    res.status(201).json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/advances/:advanceId', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    const advance = land.advances.id(req.params.advanceId);
    if (!advance) return res.status(404).json({ message: 'Advance not found' });
    Object.assign(advance, req.body);
    await land.save();
    res.json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id/advances/:advanceId', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    land.advances.pull({ _id: req.params.advanceId });
    await land.save();
    res.json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/sales', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    land.sales.push(req.body);
    await land.save();

    await createAuditLog({
      module: 'lands', action: 'add-land-sale', entityType: 'Land',
      entityId: land._id, user: req.user,
      description: `Added sale entry to land ${land.landName}`,
    });

    res.status(201).json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/sales/:saleId', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    const sale = land.sales.id(req.params.saleId);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    Object.assign(sale, req.body);
    await land.save();
    res.json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id/sales/:saleId', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    land.sales.pull({ _id: req.params.saleId });
    await land.save();
    res.json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/history', auth, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id);
    if (!land) return res.status(404).json({ message: 'Land not found' });
    land.history.push({
      section: req.body.section || '',
      field: req.body.field || '',
      oldValue: req.body.oldValue,
      newValue: req.body.newValue,
      updatedBy: req.user?.name || '',
      updatedDate: new Date().toISOString(),
    });
    await land.save();
    res.status(201).json({ land });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
