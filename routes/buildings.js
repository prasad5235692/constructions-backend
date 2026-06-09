const express = require('express');
const Building = require('../models/Building');
const BuildingMaterial = require('../models/BuildingMaterial');
const Payment = require('../models/Payment');
const RestockRequest = require('../models/RestockRequest');
const Attendance = require('../models/Attendance');
const SalaryEntry = require('../models/SalaryEntry');
const Approval = require('../models/Approval');
const ClientPayment = require('../models/ClientPayment');
const CompanyExpense = require('../models/CompanyExpense');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validation');
const { updateBuildingToProcessing, autoProcessBuildingIfHasActivity } = require('../utils/buildingHelpers');

const router = express.Router();

// PATCH /api/buildings/:id/complete — mark building as completed
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ message: 'Building not found' });
    if (building.status === 'Completed') return res.status(400).json({ message: 'Building is already completed' });

    building.status = 'Completed';
    building.completedDate = new Date().toISOString().split('T')[0];
    await building.save();

    await createAuditLog({
      module: 'buildings',
      action: 'complete-building',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Marked building ${building.buildingName} as completed`,
    });

    res.json({ building });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/buildings
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const buildings = await Building.find(filter)
      .populate('employeeIds', 'employeeName roleTitle')
      .populate('vendorIds', 'vendorName phone')
      .sort({ createdAt: -1 });

    res.json({ buildings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/buildings/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const building = await Building.findById(req.params.id)
      .populate('employeeIds')
      .populate('vendorIds');
    if (!building) return res.status(404).json({ message: 'Building not found' });

    const autoProcessed = await autoProcessBuildingIfHasActivity(req.params.id);
    if (autoProcessed) {
      building.status = 'Processing';
    }

    res.json({ building });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/buildings/:id/activity-logs — aggregate activity logs for the building from ALL modules
router.get('/:id/activity-logs', auth, async (req, res) => {
  try {
    const { period } = req.query;
    const buildingId = req.params.id;
    const building = await Building.findById(buildingId);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    const now = new Date();
    let dateCutoff = 0;
    if (period === 'today') {
      dateCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (period === 'weekly') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      dateCutoff = weekStart.getTime();
    } else if (period === 'monthly') {
      dateCutoff = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    const isInPeriod = (dateStr) => {
      if (!dateStr || !dateCutoff) return true;
      return new Date(dateStr).getTime() >= dateCutoff;
    };

    const logs = [];

    // 1. Building daily updates
    (building.dailyUpdates || []).forEach((u) => {
      if (!isInPeriod(u.date)) return;
      logs.push({
        type: 'daily-update',
        title: 'Daily Update',
        description: u.note || '',
        date: u.date || '',
        timestamp: u.date ? new Date(u.date).getTime() : 0,
      });
    });

    // 2. Building remarks
    (building.remarks || []).forEach((r) => {
      if (!isInPeriod(r.date)) return;
      logs.push({
        type: 'remark',
        title: 'Remark',
        description: r.text || '',
        date: r.date || '',
        timestamp: r.date ? new Date(r.date).getTime() : 0,
        author: r.author || '',
      });
    });

    // 3. Material Orders (from BuildingMaterial)
    try {
      const materials = await BuildingMaterial.find({ buildingId });
      materials.forEach((m) => {
        const d = m.addedDate || m.createdAt;
        if (!isInPeriod(d)) return;
        logs.push({
          type: 'material-order',
          title: 'Material Order',
          description: `${m.materialName} — ${m.quantity} ${m.unit}`,
          details: `Vendor: ${m.vendorName || 'N/A'} • ₹${(m.totalAmount || 0).toLocaleString('en-IN')}`,
          date: d,
          timestamp: d ? new Date(d).getTime() : 0,
        });
        // Payment history entries
        (m.paymentHistory || []).forEach((ph) => {
          if (!isInPeriod(ph.date)) return;
          logs.push({
            type: 'material-payment',
            title: 'Material Payment',
            description: `${m.materialName} — ${ph.type}`,
            details: `Paid: ₹${(ph.amount || 0).toLocaleString('en-IN')}`,
            date: ph.date,
            timestamp: ph.date ? new Date(ph.date).getTime() : 0,
          });
        });
      });
    } catch (_) { /* skip */ }

    // 4. Restock Requests
    try {
      const restocks = await RestockRequest.find({ buildingId });
      restocks.forEach((r) => {
        const d = r.requestedDate || r.createdAt;
        if (!isInPeriod(d)) return;
        logs.push({
          type: 'restock',
          title: 'Restock Request',
          description: `${r.materialName} — ${r.quantity} ${r.unit}`,
          details: `Status: ${r.status} • ₹${(r.totalAmount || 0).toLocaleString('en-IN')}`,
          date: d,
          timestamp: d ? new Date(d).getTime() : 0,
        });
      });
    } catch (_) { /* skip */ }

    // 5. Employee Attendance
    try {
      const attendances = await Attendance.find({ buildingId }).populate('employeeId', 'employeeName');
      attendances.forEach((a) => {
        if (!isInPeriod(a.attendanceDate)) return;
        logs.push({
          type: 'attendance',
          title: 'Employee Attendance',
          description: `${a.employeeId?.employeeName || 'Unknown'} — ${a.status}`,
          details: `Check-in: ${a.checkInTime || 'N/A'}`,
          date: a.attendanceDate,
          timestamp: a.attendanceDate ? new Date(a.attendanceDate).getTime() : 0,
        });
      });
    } catch (_) { /* skip */ }

    // 6. Salary Entries (Employee salary payments)
    try {
      const salaries = await SalaryEntry.find({ buildingId }).populate('employeeId', 'employeeName');
      salaries.forEach((s) => {
        if (!isInPeriod(s.workDate)) return;
        logs.push({
          type: 'salary-payment',
          title: 'Employee Salary',
          description: `${s.employeeId?.employeeName || 'Unknown'} — ${s.paymentStatus}`,
          details: `Paid: ₹${(s.netAmount || 0).toLocaleString('en-IN')}`,
          date: s.workDate,
          timestamp: s.workDate ? new Date(s.workDate).getTime() : 0,
        });
      });
    } catch (_) { /* skip */ }

    // 7. Approvals (from Approval model)
    try {
      const approvals = await Approval.find({ buildingId });
      approvals.forEach((a) => {
        const d = a.approvedDate || a.createdAt;
        if (!isInPeriod(d)) return;
        logs.push({
          type: 'approval',
          title: 'Approval',
          description: `${a.category} — ${a.approvalName}`,
          details: `Status: ${a.status} • ₹${(a.amount || 0).toLocaleString('en-IN')}`,
          date: d,
          timestamp: d ? new Date(d).getTime() : 0,
        });
      });
    } catch (_) { /* skip */ }

    // 8. Payments (general payments: construction, vendor, etc.)
    try {
      const payments = await Payment.find({ buildingId });
      payments.forEach((p) => {
        const d = p.paidDate || p.dueDate || p.createdAt;
        if (!isInPeriod(d)) return;
        logs.push({
          type: 'payment',
          title: p.category === 'Salary' ? 'Salary Payment' : p.category === 'Vendor' ? 'Vendor Payment' : p.category === 'Material' ? 'Material Payment' : 'Construction Payment',
          description: `${p.title || 'Payment'} — ${p.paidTo || p.category}`,
          details: `Amount: ₹${(p.amount || 0).toLocaleString('en-IN')} • ${p.status}`,
          date: d,
          timestamp: d ? new Date(d).getTime() : 0,
        });
      });
    } catch (_) { /* skip */ }

    // 9. Client Payments
    try {
      const clientPmts = await ClientPayment.find({ buildingId });
      clientPmts.forEach((cp) => {
        const d = cp.paymentDate || cp.createdAt;
        if (!isInPeriod(d)) return;
        logs.push({
          type: 'client-payment',
          title: 'Client Payment',
          description: cp.paymentType || 'Payment Received',
          details: `Received: ₹${(cp.amount || 0).toLocaleString('en-IN')}`,
          date: d,
          timestamp: d ? new Date(d).getTime() : 0,
        });
      });
    } catch (_) { /* skip */ }

    // 10. Company Expenses
    try {
      const expenses = await CompanyExpense.find({ buildingId });
      expenses.forEach((e) => {
        if (!(e.enabled === true && e.amount > 0)) return;
        const d = e.enteredDate || e.createdAt;
        if (!isInPeriod(d)) return;
        logs.push({
          type: 'company-expense',
          title: 'Company Expense',
          description: `${e.expenseName || 'Expense'} — ${e.category}`,
          details: `Amount: ₹${(e.amount || 0).toLocaleString('en-IN')}${e.isRental ? ' (Rental)' : ''}`,
          date: d,
          timestamp: d ? new Date(d).getTime() : 0,
        });
      });
    } catch (_) { /* skip */ }

    // 11. Building status updates (tracked via dailyUpdates with status changes)
    if (building.completedDate && isInPeriod(building.completedDate)) {
      logs.push({
        type: 'status-update',
        title: 'Building Status Update',
        description: 'Project marked as Completed',
        details: `Completed on ${building.completedDate}`,
        date: building.completedDate,
        timestamp: building.completedDate ? new Date(building.completedDate).getTime() : 0,
      });
    }

    res.json({ logs: logs.sort((a, b) => b.timestamp - a.timestamp) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/buildings
router.post('/', auth, async (req, res) => {
  try {
    if (!isNonEmptyString(req.body.buildingName)) {
      return res.status(400).json({ message: 'Building name required' });
    }

    if (!isNonEmptyString(req.body.partyName)) {
      return res.status(400).json({ message: 'Party name required' });
    }

    const building = await Building.create({
      buildingName: req.body.buildingName.trim(),
      partyName: req.body.partyName.trim(),
      mobile: req.body.mobile || '',
      address: req.body.address || '',
      totalAmount: req.body.totalAmount || 0,
      advanceAvailable: req.body.advanceAvailable || 'No',
      advanceAmount: req.body.advanceAvailable === 'Yes' ? (req.body.advanceAmount || 0) : 0,
      startDate: req.body.startDate || '',
      endDate: req.body.endDate || '',
      buildingType: req.body.buildingType || '',
      clientName: req.body.partyName.trim(),
      siteAddress: req.body.address || '',
    });

    await createAuditLog({
      module: 'buildings',
      action: 'create-building',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Created building ${building.buildingName}`,
    });

    res.status(201).json({ building });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/buildings/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.buildingName !== undefined && !isNonEmptyString(req.body.buildingName)) {
      return res.status(400).json({ message: 'Building name cannot be empty' });
    }

    const allowedFields = [
      'buildingName', 'partyName', 'mobile', 'address',
      'totalAmount', 'advanceAvailable', 'advanceAmount',
      'startDate', 'endDate', 'buildingType',
      'clientName', 'siteAddress', 'landId',
      'floors', 'buildingArea', 'agreementDetails',
      'constructionProgress', 'totalExpense',
      'totalReceivedPayment', 'materialsSummary',
      'approvals', 'advances',
      'party', 'plotter', 'structural', 'pooja',
      'bore', 'storeRoom', 'ebConstruction', 'sand', 'aggregate',
      'bricks', 'cement', 'steel', 'equipment', 'masonWork',
      'fitter', 'electricianWorks', 'plumberWorks', 'painter',
      'carpenter', 'tiles', 'welder', 'freight',
      'udgConnectionWork', 'gift', 'sathakka',
      'employeeIds', 'vendorIds',
      'projectAmount', 'completedDate', 'status',
    ];

    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        building[field] = req.body[field];
      }
    }

    await building.save();

    await createAuditLog({
      module: 'buildings',
      action: 'update-building',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Updated building ${building.buildingName}`,
      changes: update,
    });

    res.json({ building });

    updateBuildingToProcessing(req.params.id);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/buildings/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const building = await Building.findByIdAndDelete(req.params.id);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    await createAuditLog({
      module: 'buildings',
      action: 'delete-building',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Deleted building ${building.buildingName}`,
    });

    res.json({ message: 'Building deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/buildings/:id/daily-updates
router.post('/:id/daily-updates', auth, async (req, res) => {
  try {
    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    building.dailyUpdates.push({
      date: req.body.date || new Date().toISOString(),
      note: req.body.note || '',
    });
    await building.save();

    await createAuditLog({
      module: 'buildings',
      action: 'add-daily-update',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Added daily update to ${building.buildingName}`,
    });

    res.status(201).json({ building });

    updateBuildingToProcessing(req.params.id);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/buildings/:id/remarks
router.post('/:id/remarks', auth, async (req, res) => {
  try {
    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    building.remarks.push({
      text: req.body.text,
      date: req.body.date || new Date().toISOString(),
      author: req.user.name,
    });
    await building.save();

    await createAuditLog({
      module: 'buildings',
      action: 'add-building-remark',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Added remark to ${building.buildingName}`,
    });

    res.status(201).json({ building });

    updateBuildingToProcessing(req.params.id);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/buildings/:id/approvals/:approvalKey
router.put('/:id/approvals/:approvalKey', auth, async (req, res) => {
  try {
    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    const approvals = building.approvals || new Map();
    approvals.set(req.params.approvalKey, {
      status: req.body.status || 'Pending',
      date: req.body.date || '',
      amount: req.body.amount || 0,
      remarks: req.body.remarks || '',
    });
    building.approvals = approvals;
    await building.save();

    await createAuditLog({
      module: 'buildings',
      action: 'update-building-approval',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Updated ${req.params.approvalKey} approval on ${building.buildingName}`,
      metadata: { approvalKey: req.params.approvalKey },
    });

    res.json({ building });

    updateBuildingToProcessing(req.params.id);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/buildings/:id/status — update building status (e.g., New → Processing)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    const validStatuses = ['New', 'Processing', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ message: 'Building not found' });

    // Only allow transition: New → Processing (or any to any if explicitly called)
    if (building.status === 'Completed' && status !== 'Completed') {
      return res.status(400).json({ message: 'Cannot change status of a completed building' });
    }

    building.status = status;
    await building.save();

    await createAuditLog({
      module: 'buildings',
      action: 'update-building-status',
      entityType: 'Building',
      entityId: building._id,
      user: req.user,
      description: `Updated building ${building.buildingName} status to ${status}`,
    });

    res.json({ building });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
