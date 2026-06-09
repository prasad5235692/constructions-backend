const mongoose = require('mongoose');
const { USER_ROLES } = require('../utils/auth');

const buildingPermissionSchema = new mongoose.Schema({
  access: { type: Boolean, default: true },
  overview: { type: Boolean, default: true },
  companyPayments: { type: Boolean, default: true },
  clientPayments: { type: Boolean, default: true },
  constructionPayments: { type: Boolean, default: true },
  employees: { type: Boolean, default: true },
  salary: { type: Boolean, default: true },
  attendance: { type: Boolean, default: true },
  materials: { type: Boolean, default: true },
  approvals: { type: Boolean, default: true },
  landDetails: { type: Boolean, default: true },
}, { _id: false });

const permissionSchema = new mongoose.Schema({
  dashboard: { type: Boolean, default: true },
  lands: { type: Boolean, default: true },
  buildings: { type: buildingPermissionSchema, default: () => ({}) },
  employees: { type: Boolean, default: true },
  materials: { type: Boolean, default: true },
  users: { type: Boolean, default: true },
  settings: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  mobileNumber: { type: String, default: '' },
  role: {
    type: String,
    enum: [USER_ROLES.MASTER_ADMIN, USER_ROLES.ADMIN],
    default: USER_ROLES.ADMIN,
  },
  permissions: { type: permissionSchema, default: () => ({}) },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  assignedBuildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', default: null },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

function getDefaultBuildingPermissions() {
  return {
    access: true, overview: true,
    companyPayments: true, clientPayments: true, constructionPayments: true,
    employees: true, salary: true, attendance: true,
    materials: true, approvals: true, landDetails: true,
  };
}

function getDefaultPermissions() {
  return {
    dashboard: true, lands: true,
    buildings: getDefaultBuildingPermissions(),
    employees: true, materials: true, users: true, settings: true,
  };
}

userSchema.pre('save', function (next) {
  if (this.role === USER_ROLES.MASTER_ADMIN) {
    this.permissions = getDefaultPermissions();
    return next();
  }
  if (this.permissions) {
    const perms = this.permissions;
    if (perms.buildings === true || perms.buildings === false) {
      perms.buildings = getDefaultBuildingPermissions();
    }
    if (typeof perms.buildings === 'object' && perms.buildings !== null && !perms.buildings.access) {
      perms.buildings = { ...getDefaultBuildingPermissions(), ...perms.buildings };
    }
  }
  next();
});

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
module.exports.getDefaultPermissions = getDefaultPermissions;
module.exports.getDefaultBuildingPermissions = getDefaultBuildingPermissions;
