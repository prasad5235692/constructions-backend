const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const USER_ROLES = Object.freeze({
  MASTER_ADMIN: 'masterAdmin',
  ADMIN: 'admin',
});

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

function signAuthToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
}

function sanitizeUser(user) {
  const source = typeof user.toObject === 'function' ? user.toObject() : user;

  return {
    id: source._id?.toString?.() || source.id,
    name: source.name,
    email: source.email,
    phone: source.phone,
    mobileNumber: source.mobileNumber || '',
    role: source.role,
    permissions: source.permissions || {},
    status: source.status || 'active',
    assignedBuildingId: source.assignedBuildingId || null,
    employeeId: source.employeeId || null,
    isActive: source.isActive,
    lastLoginAt: source.lastLoginAt || null,
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
  };
}

function isMasterAdmin(user) {
  return user?.role === USER_ROLES.MASTER_ADMIN;
}

function canManageUserRole(role) {
  return role === USER_ROLES.ADMIN;
}

function getMasterAdminPermissions() {
  return {
    dashboard: true,
    lands: true,
    buildings: {
      access: true,
      overview: true,
      companyPayments: true,
      clientPayments: true,
      constructionPayments: true,
      employees: true,
      salary: true,
      attendance: true,
      materials: true,
      approvals: true,
      landDetails: true,
    },
    employees: true,
    materials: true,
    users: true,
    settings: true,
  };
}

function applyMasterAdminPermissions(user) {
  if (user && user.role === USER_ROLES.MASTER_ADMIN) {
    user.permissions = getMasterAdminPermissions();
  }
  return user;
}

module.exports = {
  USER_ROLES,
  applyMasterAdminPermissions,
  canManageUserRole,
  comparePassword,
  getMasterAdminPermissions,
  hashPassword,
  isMasterAdmin,
  normalizeEmail,
  sanitizeUser,
  signAuthToken,
};