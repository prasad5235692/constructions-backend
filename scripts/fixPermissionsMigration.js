require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { getMasterAdminPermissions } = require('../utils/auth');

const run = async () => {
  try {
    await connectDB();
    console.log('Connected to DB. Scanning for users with invalid permissions...');

    const allUsers = await User.find({});
    let fixed = 0;

    for (const user of allUsers) {
      let needsSave = false;

      if (!user.permissions) {
        user.permissions = user.role === 'masterAdmin'
          ? getMasterAdminPermissions()
          : {};
        needsSave = true;
      }

      const perms = user.permissions;

      if (perms.buildings === true || perms.buildings === false) {
        perms.buildings = {
          access: true, overview: true, employees: true, salary: true,
          materials: true, approvals: true, landDetails: true,
        };
        needsSave = true;
      }

      if (perms.dashboard === undefined) { perms.dashboard = true; needsSave = true; }
      if (perms.lands === undefined) { perms.lands = true; needsSave = true; }
      if (perms.employees === undefined) { perms.employees = true; needsSave = true; }
      if (perms.materials === undefined) { perms.materials = true; needsSave = true; }
      if (perms.users === undefined) { perms.users = true; needsSave = true; }
      if (perms.settings === undefined) { perms.settings = true; needsSave = true; }

      if (needsSave) {
        user.markModified('permissions');
        await user.save();
        fixed++;
        console.log(`Fixed user: ${user.email} (${user._id})`);
      }
    }

    console.log(`Migration complete. Fixed ${fixed} users.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();
