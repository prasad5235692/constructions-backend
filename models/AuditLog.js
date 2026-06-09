const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  module: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, default: '' },
  entityId: { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  performedByRole: { type: String, default: '' },
  description: { type: String, default: '' },
  changes: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);