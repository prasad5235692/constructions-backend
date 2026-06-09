const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const {
  USER_ROLES, applyMasterAdminPermissions, canManageUserRole, comparePassword, hashPassword,
  isMasterAdmin, normalizeEmail, sanitizeUser, signAuthToken,
} = require('../utils/auth');
const { isNonEmptyString, requireFields } = require('../utils/validation');

const router = express.Router();

function validatePassword(password) {
  if (typeof password !== 'string' || password.trim().length < 6) {
    return 'Password must be at least 6 characters long';
  }
  return null;
}

const defaultPermissions = {
  dashboard: true, lands: true, employees: true, materials: true, users: true, settings: true,
  buildings: { access: true, overview: true, companyPayments: true, clientPayments: true, constructionPayments: true, employees: true, salary: true, attendance: true, materials: true, approvals: true, landDetails: true },
};

// GET /api/users
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ users: users.map((u) => sanitizeUser(applyMasterAdminPermissions(u))) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('createdBy', 'name email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: sanitizeUser(applyMasterAdminPermissions(user)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/users
router.post('/', auth, async (req, res) => {
  try {
    const missingFields = requireFields(req.body, ['name', 'email', 'password']);
    if (missingFields.length > 0) {
      return res.status(400).json({ message: `${missingFields.join(', ')} required` });
    }

    const requestedRole = req.body.role || USER_ROLES.ADMIN;
    if (!canManageUserRole(requestedRole)) {
      return res.status(400).json({ message: 'Only admin role is allowed' });
    }

    if (!isMasterAdmin(req.user) && requestedRole === USER_ROLES.MASTER_ADMIN) {
      return res.status(403).json({ message: 'Only Master Admin can create Master Admin users' });
    }

    const passwordError = validatePassword(req.body.password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const email = normalizeEmail(req.body.email);
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User with this email already exists' });

    const permissions = req.body.permissions
      ? { ...defaultPermissions, ...req.body.permissions }
      : defaultPermissions;

    const user = await User.create({
      name: req.body.name.trim(),
      email,
      password: await hashPassword(req.body.password),
      phone: req.body.phone || '',
      mobileNumber: req.body.mobileNumber || '',
      role: requestedRole,
      permissions,
      status: req.body.status || 'active',
      isActive: req.body.status !== 'inactive',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await createAuditLog({
      module: 'users',
      action: 'create-user',
      entityType: 'User',
      entityId: user._id,
      user: req.user,
      description: `Created ${user.role} user ${user.email}`,
    });

    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isSelf = user._id.toString() === req.user._id.toString();

    if (user.role === USER_ROLES.MASTER_ADMIN) {
      const protectedFields = ['permissions', 'role', 'status', 'isActive'];
      for (const field of protectedFields) {
        if (req.body[field] !== undefined) {
          return res.status(403).json({
            success: false,
            message: `Master Admin ${field} cannot be modified`,
          });
        }
      }
    }

    if (req.body.role && !canManageUserRole(req.body.role)) {
      return res.status(400).json({ message: 'Only admin role is allowed' });
    }

    if (req.body.role && isSelf && req.body.role !== user.role) {
      return res.status(400).json({ message: 'You cannot change your own role here' });
    }

    if (isNonEmptyString(req.body.name)) user.name = req.body.name.trim();

    if (req.body.email !== undefined) {
      const email = normalizeEmail(req.body.email);
      const existing = await User.findOne({ email, _id: { $ne: user._id } });
      if (existing) return res.status(400).json({ message: 'Email already in use' });
      user.email = email;
    }

    if (req.body.phone !== undefined) user.phone = req.body.phone || '';
    if (req.body.mobileNumber !== undefined) user.mobileNumber = req.body.mobileNumber || '';
    if (req.body.role) user.role = req.body.role;

    if (req.body.permissions !== undefined) {
      user.permissions = { ...defaultPermissions, ...req.body.permissions };
    }

    if (req.body.status !== undefined) {
      user.status = req.body.status;
      user.isActive = req.body.status === 'active';
    }

    if (req.body.isActive !== undefined) {
      user.isActive = Boolean(req.body.isActive);
      user.status = user.isActive ? 'active' : 'inactive';
    }

    if (req.body.password !== undefined) {
      const passwordError = validatePassword(req.body.password);
      if (passwordError) return res.status(400).json({ message: passwordError });
      user.password = await hashPassword(req.body.password);
    }

    user.updatedBy = req.user._id;
    await user.save();

    await createAuditLog({
      module: 'users',
      action: 'update-user',
      entityType: 'User',
      entityId: user._id,
      user: req.user,
      description: `Updated user ${user.email}`,
    });

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    if (user.role === USER_ROLES.MASTER_ADMIN) {
      return res.status(403).json({ message: 'Master Admin cannot be deleted' });
    }

    await user.deleteOne();

    await createAuditLog({
      module: 'users',
      action: 'delete-user',
      entityType: 'User',
      entityId: user._id,
      user: req.user,
      description: `Deleted user ${user.email}`,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/users/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active or inactive' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own status' });
    }

    if (user.role === USER_ROLES.MASTER_ADMIN) {
      return res.status(403).json({ message: 'Master Admin status cannot be changed' });
    }

    user.status = status;
    user.isActive = status === 'active';
    user.updatedBy = req.user._id;
    await user.save();

    await createAuditLog({
      module: 'users',
      action: 'toggle-status',
      entityType: 'User',
      entityId: user._id,
      user: req.user,
      description: `${status === 'active' ? 'Activated' : 'Deactivated'} user ${user.email}`,
    });

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
