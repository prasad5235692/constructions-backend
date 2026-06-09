const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

// Enable virtuals (id) in JSON output
mongoose.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    if (ret && ret._id != null) {
      ret.id = typeof ret._id.toString === 'function' ? ret._id.toString() : String(ret._id);
    }

    delete ret.__v;
    return ret;
  },
});

// Import routes
const authRoutes = require('./routes/auth');
const landRoutes = require('./routes/lands');
const buildingRoutes = require('./routes/buildings');
const employeeRoutes = require('./routes/employees');
const materialRoutes = require('./routes/materials');
const vendorRoutes = require('./routes/vendors');
const paymentRoutes = require('./routes/payments');
const remarkRoutes = require('./routes/remarks');
const leaveRequestRoutes = require('./routes/leaveRequests');
const dashboardRoutes = require('./routes/dashboard');
const documentRoutes = require('./routes/documents');
const salaryMasterRoutes = require('./routes/salaryMasters');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const salaryRoutes = require('./routes/salary');
const salaryEntryRoutes = require('./routes/salaryEntry');
const advanceRoutes = require('./routes/advance');
const buildingMaterialRoutes = require('./routes/buildingMaterials');
const materialUsageRoutes = require('./routes/materialUsage');
const approvalRoutes = require('./routes/approvals');
const buildingApprovalRoutes = require('./routes/buildingApprovals');
const companyExpenseRoutes = require('./routes/companyExpenses');
const clientPaymentRoutes = require('./routes/clientPayments');
const restockRequestRoutes = require('./routes/restockRequests');
const workRoutes = require('./routes/work');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploads directory if it exists (local dev only)
const uploadsPath = path.join(__dirname, 'uploads');
const fs = require('fs');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/lands', landRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/remarks', remarkRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/salary-masters', salaryMasterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/salary-entry', salaryEntryRoutes);
app.use('/api/advance', advanceRoutes);
app.use('/api/building-materials', buildingMaterialRoutes);
app.use('/api/material-usage', materialUsageRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/buildings/:buildingId/approvals', buildingApprovalRoutes);
app.use('/api/buildings/:buildingId/company-expenses', companyExpenseRoutes);
app.use('/api/buildings/:buildingId/client-payments', clientPaymentRoutes);
app.use('/api/buildings/:buildingId/company-expenses', companyExpenseRoutes);
app.use('/api/restock-requests', restockRequestRoutes);
app.use('/api/work', workRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
