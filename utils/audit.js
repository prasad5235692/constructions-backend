const AuditLog = require('../models/AuditLog');

async function createAuditLog({
  module,
  action,
  entityType = '',
  entityId = '',
  user = null,
  description = '',
  changes = null,
  metadata = null,
}) {
  try {
    await AuditLog.create({
      module,
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      performedBy: user?._id || null,
      performedByRole: user?.role || '',
      description,
      changes,
      metadata,
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

module.exports = { createAuditLog };