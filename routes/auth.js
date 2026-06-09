const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const {
  USER_ROLES,
  applyMasterAdminPermissions,
  canManageUserRole,
  comparePassword,
  hashPassword,
  isMasterAdmin,
  normalizeEmail,
  sanitizeUser,
  signAuthToken,
} = require('../utils/auth');
const { isNonEmptyString, requireFields } = require('../utils/validation');

const router = express.Router();

function ensureMasterAdmin(req, res) {
  if (!isMasterAdmin(req.user)) {
    res.status(403).json({ message: 'Access denied. Master Admin only.' });
    return false;
  }

  return true;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.trim().length < 8) {
    return 'Password must be at least 8 characters long';
  }

  return null;
}

async function createAdminUser(req, res) {
  try {
    if (!ensureMasterAdmin(req, res)) {
      return;
    }

    const missingFields = requireFields(req.body, ['name', 'email', 'password']);
    if (missingFields.length > 0) {
      return res.status(400).json({ message: `${missingFields.join(', ')} required` });
    }

    const requestedRole = req.body.role || USER_ROLES.ADMIN;
    if (!canManageUserRole(requestedRole)) {
      return res.status(400).json({ message: 'Only admin users can be created from this endpoint' });
    }

    const passwordError = validatePassword(req.body.password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const email = normalizeEmail(req.body.email);
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const user = await User.create({
      name: req.body.name.trim(),
      email,
      password: await hashPassword(req.body.password),
      phone: isNonEmptyString(req.body.phone) ? req.body.phone.trim() : '',
      role: requestedRole,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await createAuditLog({
      module: 'auth',
      action: 'create-user',
      entityType: 'User',
      entityId: user._id,
      user: req.user,
      description: `Created ${user.role} user ${user.email}`,
    });

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const missingFields = requireFields(req.body, ['email', 'password']);
    if (missingFields.length > 0) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    applyMasterAdminPermissions(user);
    user.lastLoginAt = new Date();
    user.updatedBy = user._id;
    await user.save();

    const token = signAuthToken(user);

    await createAuditLog({
      module: 'auth',
      action: 'login',
      entityType: 'User',
      entityId: user._id,
      user,
      description: `User ${user.email} logged in`,
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  await createAuditLog({
    module: 'auth',
    action: 'logout',
    entityType: 'User',
    entityId: req.user._id,
    user: req.user,
    description: `User ${req.user.email} logged out`,
  });

  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  applyMasterAdminPermissions(req.user);
  res.json({ user: sanitizeUser(req.user) });
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!isNonEmptyString(name) && !isNonEmptyString(phone)) {
      return res.status(400).json({ message: 'At least one profile field is required' });
    }

    if (isNonEmptyString(name)) {
      req.user.name = name.trim();
    }

    if (phone !== undefined) {
      req.user.phone = isNonEmptyString(phone) ? phone.trim() : '';
    }

    req.user.updatedBy = req.user._id;
    await req.user.save();

    applyMasterAdminPermissions(req.user);

    await createAuditLog({
      module: 'auth',
      action: 'update-profile',
      entityType: 'User',
      entityId: req.user._id,
      user: req.user,
      description: `Updated profile for ${req.user.email}`,
      changes: { name: req.user.name, phone: req.user.phone },
    });

    res.json({ user: sanitizeUser(req.user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const isMatch = await comparePassword(currentPassword, req.user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    req.user.password = await hashPassword(newPassword);
    req.user.updatedBy = req.user._id;
    await req.user.save();

    await createAuditLog({
      module: 'auth',
      action: 'change-password',
      entityType: 'User',
      entityId: req.user._id,
      user: req.user,
      description: `Password changed for ${req.user.email}`,
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/create-admin (Master Admin only)
router.post('/create-admin', auth, createAdminUser);

// POST /api/auth/users (Master Admin only)
router.post('/users', auth, createAdminUser);

// GET /api/auth/users (Master Admin only)
router.get('/users', auth, async (req, res) => {
  try {
    if (!ensureMasterAdmin(req, res)) {
      return;
    }

    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users: users.map((user) => sanitizeUser(user)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/auth/users/:id (Master Admin only)
router.put('/users/:id', auth, async (req, res) => {
  try {
    if (!ensureMasterAdmin(req, res)) {
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === USER_ROLES.MASTER_ADMIN && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Master admin users cannot be managed from this endpoint' });
    }

    if (req.body.role && !canManageUserRole(req.body.role)) {
      return res.status(400).json({ message: 'Only admin role is allowed for managed users' });
    }

    if (req.body.role && user._id.toString() === req.user._id.toString() && req.body.role !== user.role) {
      return res.status(400).json({ message: 'You cannot change your own role here' });
    }

    if (isNonEmptyString(req.body.name)) {
      user.name = req.body.name.trim();
    }

    if (req.body.email !== undefined) {
      const email = normalizeEmail(req.body.email);
      const existing = await User.findOne({ email, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      user.email = email;
    }

    if (req.body.phone !== undefined) {
      user.phone = isNonEmptyString(req.body.phone) ? req.body.phone.trim() : '';
    }

    if (req.body.role) {
      user.role = req.body.role;
    }

    if (req.body.isActive !== undefined) {
      user.isActive = Boolean(req.body.isActive);
    }

    if (req.body.password !== undefined) {
      const passwordError = validatePassword(req.body.password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }
      user.password = await hashPassword(req.body.password);
    }

    user.updatedBy = req.user._id;
    await user.save();

    await createAuditLog({
      module: 'auth',
      action: 'update-user',
      entityType: 'User',
      entityId: user._id,
      user: req.user,
      description: `Updated user ${user.email}`,
      changes: {
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
    });

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/auth/users/:id (Master Admin only)
router.delete('/users/:id', auth, async (req, res) => {
  try {
    if (!ensureMasterAdmin(req, res)) {
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    if (user.role === USER_ROLES.MASTER_ADMIN) {
      return res.status(403).json({ message: 'Master admin users cannot be deleted from this endpoint' });
    }

    await user.deleteOne();

    await createAuditLog({
      module: 'auth',
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

module.exports = router;
