require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const { Material } = require('./models/Material');
const { hashPassword, normalizeEmail, USER_ROLES, getMasterAdminPermissions } = require('./utils/auth');

const seed = async () => {
  try {
    await connectDB();

    const seedMasterAdminName = process.env.SEED_MASTER_ADMIN_NAME;
    const seedMasterAdminEmail = normalizeEmail(process.env.SEED_MASTER_ADMIN_EMAIL);
    const seedMasterAdminPassword = process.env.SEED_MASTER_ADMIN_PASSWORD;

    if (seedMasterAdminName && seedMasterAdminEmail && seedMasterAdminPassword) {
      const existingAdmin = await User.findOne({ email: seedMasterAdminEmail });
      if (!existingAdmin) {
        await User.create({
          name: seedMasterAdminName.trim(),
          email: seedMasterAdminEmail,
          password: await hashPassword(seedMasterAdminPassword),
          phone: process.env.SEED_MASTER_ADMIN_PHONE || '',
          role: USER_ROLES.MASTER_ADMIN,
          permissions: getMasterAdminPermissions(),
        });
        console.log(`Master admin user created for ${seedMasterAdminEmail}`);
      } else {
        console.log('Seed master admin already exists');
      }
    } else {
      console.log('Skipping master admin bootstrap. Set SEED_MASTER_ADMIN_* env vars to create one.');
    }

    // Seed master materials
    const materialCount = await Material.countDocuments({ isMaster: true });
    if (materialCount === 0) {
      const materials = [
        // Cement brands
        { materialName: 'Ramco Cement', category: 'Cement', brand: 'Ramco', unit: 'Bags', isMaster: true, rate: 430 },
        { materialName: 'Dalmia Cement', category: 'Cement', brand: 'Dalmia', unit: 'Bags', isMaster: true, rate: 425 },
        { materialName: 'UltraTech Cement', category: 'Cement', brand: 'UltraTech', unit: 'Bags', isMaster: true, rate: 440 },
        { materialName: 'India Cement', category: 'Cement', brand: 'India Cement', unit: 'Bags', isMaster: true, rate: 420 },
        { materialName: 'Sahar Cement', category: 'Cement', brand: 'Sahar', unit: 'Bags', isMaster: true, rate: 410 },
        { materialName: 'Arasu Cement', category: 'Cement', brand: 'Arasu', unit: 'Bags', isMaster: true, rate: 400 },
        // Sand
        { materialName: 'River Sand', category: 'Sand', subCategory: 'River Sand', unit: 'Load', isMaster: true, rate: 8500 },
        { materialName: 'M Sand', category: 'Sand', subCategory: 'M Sand', unit: 'Load', isMaster: true, rate: 6000 },
        { materialName: 'P Sand', category: 'Sand', subCategory: 'P Sand', unit: 'Load', isMaster: true, rate: 6500 },
        // Bricks
        { materialName: 'Red Brick', category: 'Bricks', subCategory: 'Red Brick', unit: 'Nos', isMaster: true, rate: 12 },
        { materialName: 'Fire Clay Brick', category: 'Bricks', subCategory: 'Fire Clay Brick', unit: 'Nos', isMaster: true, rate: 18 },
        { materialName: 'Sand Lime Brick', category: 'Bricks', subCategory: 'Sand Lime Brick', unit: 'Nos', isMaster: true, rate: 15 },
        { materialName: 'Concrete Brick', category: 'Bricks', subCategory: 'Concrete Brick', unit: 'Nos', isMaster: true, rate: 40 },
        { materialName: 'Fly Ash Brick', category: 'Bricks', subCategory: 'Fly Ash Brick', unit: 'Nos', isMaster: true, rate: 10 },
        { materialName: 'Hollow Brick', category: 'Bricks', subCategory: 'Hollow Brick', unit: 'Nos', isMaster: true, rate: 35 },
        { materialName: 'Chamber Brick', category: 'Bricks', subCategory: 'Chamber Brick', unit: 'Nos', isMaster: true, rate: 11 },
        // Steel sizes
        { materialName: 'Steel 6mm', category: 'Steel', size: '6mm', unit: 'Kg', isMaster: true, rate: 72 },
        { materialName: 'Steel 8mm', category: 'Steel', size: '8mm', unit: 'Kg', isMaster: true, rate: 72 },
        { materialName: 'Steel 10mm', category: 'Steel', size: '10mm', unit: 'Kg', isMaster: true, rate: 73 },
        { materialName: 'Steel 12mm', category: 'Steel', size: '12mm', unit: 'Kg', isMaster: true, rate: 73 },
        { materialName: 'Steel 16mm', category: 'Steel', size: '16mm', unit: 'Kg', isMaster: true, rate: 74 },
        { materialName: 'Steel 20mm', category: 'Steel', size: '20mm', unit: 'Kg', isMaster: true, rate: 75 },
        { materialName: 'Steel 25mm', category: 'Steel', size: '25mm', unit: 'Kg', isMaster: true, rate: 76 },
        { materialName: 'Steel 32mm', category: 'Steel', size: '32mm', unit: 'Kg', isMaster: true, rate: 77 },
        { materialName: 'Steel 40mm', category: 'Steel', size: '40mm', unit: 'Kg', isMaster: true, rate: 78 },
        { materialName: 'Steel 50mm', category: 'Steel', size: '50mm', unit: 'Kg', isMaster: true, rate: 80 },
        // Electrical
         { materialName: 'Finolex Wire', category: 'Electrical', brand: 'Finolex', unit: 'Meter', isMaster: true, rate: 22 },
  { materialName: 'RR Wire', category: 'Electrical', brand: 'RR', unit: 'Meter', isMaster: true, rate: 20 },
  { materialName: 'V-Guard Wire', category: 'Electrical', brand: 'V-Guard', unit: 'Meter', isMaster: true, rate: 21 },
  { materialName: 'Kundan Wire', category: 'Electrical', brand: 'Kundan', unit: 'Meter', isMaster: true, rate: 18 },
  { materialName: 'Fybros Wire', category: 'Electrical', brand: 'Fybros', unit: 'Meter', isMaster: true, rate: 19 },
  { materialName: 'Norwood Wire', category: 'Electrical', brand: 'Norwood', unit: 'Meter', isMaster: true, rate: 17 },

  // Switches
  { materialName: 'Legrand Switch', category: 'Electrical', brand: 'Legrand', unit: 'Nos', isMaster: true, rate: 220 },
  { materialName: 'GM Switch', category: 'Electrical', brand: 'GM', unit: 'Nos', isMaster: true, rate: 180 },
  { materialName: 'Vinay Switch', category: 'Electrical', brand: 'Vinay', unit: 'Nos', isMaster: true, rate: 90 },
  { materialName: 'Fybros Switch', category: 'Electrical', brand: 'Fybros', unit: 'Nos', isMaster: true, rate: 120 },
  { materialName: 'Norwood Switch', category: 'Electrical', brand: 'Norwood', unit: 'Nos', isMaster: true, rate: 85 },

  // Breakers / MCB
  { materialName: 'Legrand Breaker', category: 'Electrical', brand: 'Legrand', unit: 'Nos', isMaster: true, rate: 850 },
  { materialName: 'LFT Breaker', category: 'Electrical', brand: 'LFT', unit: 'Nos', isMaster: true, rate: 450 },
  { materialName: 'Fybros Breaker', category: 'Electrical', brand: 'Fybros', unit: 'Nos', isMaster: true, rate: 550 },
  { materialName: 'Kundan Breaker', category: 'Electrical', brand: 'Kundan', unit: 'Nos', isMaster: true, rate: 500 },
  { materialName: 'Norwood Breaker', category: 'Electrical', brand: 'Norwood', unit: 'Nos', isMaster: true, rate: 400 },
  { materialName: 'Havells Breaker', category: 'Electrical', brand: 'Havells', unit: 'Nos', isMaster: true, rate: 900 },

  // DB Box
  { materialName: 'Legrand DB Box', category: 'Electrical', brand: 'Legrand', unit: 'Nos', isMaster: true, rate: 2500 },
  { materialName: 'Havells DB Box', category: 'Electrical', brand: 'Havells', unit: 'Nos', isMaster: true, rate: 2300 },

  // Fans
  { materialName: 'Crompton Fan', category: 'Electrical', brand: 'Crompton', unit: 'Nos', isMaster: true, rate: 2800 },
  { materialName: 'Havells Fan', category: 'Electrical', brand: 'Havells', unit: 'Nos', isMaster: true, rate: 3200 },
  { materialName: 'Usha Fan', category: 'Electrical', brand: 'Usha', unit: 'Nos', isMaster: true, rate: 2600 },

  // Lights
  { materialName: 'LED Bulb', category: 'Electrical', brand: 'Philips', unit: 'Nos', isMaster: true, rate: 120 },
  { materialName: 'Tube Light', category: 'Electrical', brand: 'Philips', unit: 'Nos', isMaster: true, rate: 280 },
  { materialName: 'Panel Light', category: 'Electrical', brand: 'Havells', unit: 'Nos', isMaster: true, rate: 650 },
  { materialName: 'Street Light', category: 'Electrical', brand: 'Philips', unit: 'Nos', isMaster: true, rate: 2200 },

  // Conduits
  { materialName: 'PVC Conduit Pipe', category: 'Electrical', brand: 'Finolex', unit: 'Feet', isMaster: true, rate: 45 },
  { materialName: 'Flexible Conduit Pipe', category: 'Electrical', brand: 'Finolex', unit: 'Feet', isMaster: true, rate: 55 },

   { materialName: 'Finolex Pipe', category: 'Plumbing', brand: 'Finolex', unit: 'Feet', isMaster: true, rate: 65 },
  { materialName: 'Astral Pipe', category: 'Plumbing', brand: 'Astral', unit: 'Feet', isMaster: true, rate: 85 },
  { materialName: 'Prince Pipe', category: 'Plumbing', brand: 'Prince', unit: 'Feet', isMaster: true, rate: 75 },
  { materialName: 'Star Pipe', category: 'Plumbing', brand: 'STAR', unit: 'Feet', isMaster: true, rate: 55 },
  { materialName: 'Avan Pipe', category: 'Plumbing', brand: 'Avan', unit: 'Feet', isMaster: true, rate: 50 },

  // Pipe Sizes
  { materialName: '3/4 Inch Pipe', category: 'Plumbing', brand: 'STAR', unit: 'Feet', isMaster: true, rate: 60 },
  { materialName: '1 Inch Pipe', category: 'Plumbing', brand: 'STAR', unit: 'Feet', isMaster: true, rate: 75 },
  { materialName: '1.5 Inch Pipe', category: 'Plumbing', brand: 'STAR', unit: 'Feet', isMaster: true, rate: 110 },
  { materialName: '2 Inch Pipe', category: 'Plumbing', brand: 'STAR', unit: 'Feet', isMaster: true, rate: 150 },
  { materialName: '4 Inch Pipe', category: 'Plumbing', brand: 'STAR', unit: 'Feet', isMaster: true, rate: 280 },
  { materialName: '6 Inch Pipe', category: 'Plumbing', brand: 'STAR', unit: 'Feet', isMaster: true, rate: 450 },

  // Closets
  { materialName: 'Parryware Closet', category: 'Plumbing', brand: 'Parryware', unit: 'Nos', isMaster: true, rate: 6500 },
  { materialName: 'Jaquar Closet', category: 'Plumbing', brand: 'Jaquar', unit: 'Nos', isMaster: true, rate: 12000 },
  { materialName: 'Hindware Closet', category: 'Plumbing', brand: 'Hindware', unit: 'Nos', isMaster: true, rate: 8500 },
  { materialName: 'Neycer Closet', category: 'Plumbing', brand: 'Neycer', unit: 'Nos', isMaster: true, rate: 7000 },

  // Wash Basin
  { materialName: 'Jaquar Wash Basin', category: 'Plumbing', brand: 'Jaquar', unit: 'Nos', isMaster: true, rate: 4500 },
  { materialName: 'Johnson Wash Basin', category: 'Plumbing', brand: 'Johnson', unit: 'Nos', isMaster: true, rate: 2500 },

  // Taps
  { materialName: 'Jaquar Tap', category: 'Plumbing', brand: 'Jaquar', unit: 'Nos', isMaster: true, rate: 1800 },
  { materialName: 'Plato Tap', category: 'Plumbing', brand: 'PLATO', unit: 'Nos', isMaster: true, rate: 700 },

  // Tanks
  { materialName: 'Sintex Water Tank', category: 'Plumbing', brand: 'Sintex', unit: 'Nos', isMaster: true, rate: 9500 },
  { materialName: 'Supreme Water Tank', category: 'Plumbing', brand: 'Supreme', unit: 'Nos', isMaster: true, rate: 10500 },

  // Motors
  { materialName: 'CRI Motor', category: 'Plumbing', brand: 'CRI', unit: 'Nos', isMaster: true, rate: 8500 },
  { materialName: 'Texmo Motor', category: 'Plumbing', brand: 'Texmo', unit: 'Nos', isMaster: true, rate: 9000 },
  { materialName: 'Crompton Motor', category: 'Plumbing', brand: 'Crompton', unit: 'Nos', isMaster: true, rate: 9500 },
  { materialName: 'Kirloskar Motor', category: 'Plumbing', brand: 'Kirloskar', unit: 'Nos', isMaster: true, rate: 11000 },
  { materialName: 'V-Guard Motor', category: 'Plumbing', brand: 'V-Guard', unit: 'Nos', isMaster: true, rate: 8000 },

   { materialName: 'Asian Primer', category: 'Paint', brand: 'Asian Paints', unit: 'Litre', isMaster: true, rate: 220 },
  { materialName: 'Asian Tractor Emulsion', category: 'Paint', brand: 'Asian Paints', unit: 'Litre', isMaster: true, rate: 260 },
  { materialName: 'Asian Royale', category: 'Paint', brand: 'Asian Paints', unit: 'Litre', isMaster: true, rate: 480 },

  { materialName: 'Nerolac Primer', category: 'Paint', brand: 'Nerolac', unit: 'Litre', isMaster: true, rate: 210 },
  { materialName: 'Nerolac Emulsion', category: 'Paint', brand: 'Nerolac', unit: 'Litre', isMaster: true, rate: 240 },

  { materialName: 'Berger Primer', category: 'Paint', brand: 'Berger', unit: 'Litre', isMaster: true, rate: 200 },
  { materialName: 'Berger Silk', category: 'Paint', brand: 'Berger', unit: 'Litre', isMaster: true, rate: 420 },

  { materialName: 'Wall Putty', category: 'Paint', brand: 'JK', unit: 'Bag', isMaster: true, rate: 850 },
  { materialName: 'White Cement', category: 'Paint', brand: 'Birla', unit: 'Bag', isMaster: true, rate: 950 },

  { materialName: 'Enamel Paint', category: 'Paint', brand: 'Asian Paints', unit: 'Litre', isMaster: true, rate: 320 },
  { materialName: 'Wood Polish', category: 'Paint', brand: 'Asian Paints', unit: 'Litre', isMaster: true, rate: 450 },
  { materialName: 'Red Roof Tile', category: 'Roofing', brand: 'Local', unit: 'Nos', isMaster: true, rate: 32 },
  { materialName: 'Cool Roof Tile', category: 'Roofing', brand: 'Johnson', unit: 'Nos', isMaster: true, rate: 55 },
  { materialName: 'Mangalore Tile', category: 'Roofing', brand: 'Local', unit: 'Nos', isMaster: true, rate: 28 },

  { materialName: 'GI Sheet', category: 'Roofing', brand: 'TATA', unit: 'Sq Ft', isMaster: true, rate: 110 },
  { materialName: 'Color Coated Sheet', category: 'Roofing', brand: 'JSW', unit: 'Sq Ft', isMaster: true, rate: 140 },

  { materialName: 'Roof Ridge Tile', category: 'Roofing', brand: 'Local', unit: 'Nos', isMaster: true, rate: 45 },
  { materialName: 'Gable End Tile', category: 'Roofing', brand: 'Local', unit: 'Nos', isMaster: true, rate: 50 }

      ];

      await Material.insertMany(materials);
      console.log(`${materials.length} master materials seeded`);
    } else {
      console.log('Master materials already exist');
    }

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
