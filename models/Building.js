const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  date: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  category: { type: String, default: '' },
}, { _id: false });

const approvalSchema = new mongoose.Schema({
  status: { type: String, default: 'Pending' },
  date: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { _id: false });

// Construction module sub-schemas
const partyConstructionSchema = new mongoose.Schema({
  agreement: { type: String, default: '' },
  plotArea: { type: String, default: '' },
  buildingArea: { type: String, default: '' },
  floors: { type: Number, default: 0 },
  headroom: { type: String, default: '' },
  advances: [{ label: String, amount: Number, date: String }],
}, { _id: false });

const vstSchema = new mongoose.Schema({
  advance: { type: Number, default: 0 },
  bill: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
}, { _id: false });

const udgSchema = new mongoose.Schema({
  advance: { type: Number, default: 0 },
  bill: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
}, { _id: false });

const planSchema = new mongoose.Schema({
  blueprint: { type: Number, default: 0 },
  lpa: { type: Number, default: 0 },
  development: { type: Number, default: 0 },
  unionBankDeposit: { type: Number, default: 0 },
  panchayatBill: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  president: { type: Number, default: 0 },
  engineer: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
  online: { type: Number, default: 0 },
}, { _id: false });

const plotterSchema = new mongoose.Schema({
  plan: { type: Number, default: 0 },
  centreLine: { type: Number, default: 0 },
}, { _id: false });

const structuralSchema = new mongoose.Schema({
  elevation: { type: Number, default: 0 },
  estimate: { type: Number, default: 0 },
  construction: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
}, { _id: false });

const poojaSchema = new mongoose.Schema({
  materials: { type: Number, default: 0 },
  staffCost: { type: Number, default: 0 },
}, { _id: false });

const boreSchema = new mongoose.Schema({
  feet: { type: Number, default: 0 },
  labour: { type: Number, default: 0 },
  pipeBill: { type: Number, default: 0 },
  motorBill: { type: Number, default: 0 },
  freight: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
}, { _id: false });

const storeRoomSchema = new mongoose.Schema({
  materialBill: { type: Number, default: 0 },
  labour: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
}, { _id: false });

const ebConstructionSchema = new mongoose.Schema({
  expenses: [{ name: String, amount: Number, date: String }],
}, { _id: false });

const sandSchema = new mongoose.Schema({
  rSand: [{ unit: String, date: String, amount: Number }],
  mSand: [{ unit: String, date: String, amount: Number }],
  pSand: [{ unit: String, date: String, amount: Number }],
}, { _id: false });

const aggregateSchema = new mongoose.Schema({
  size20mm: [{ unit: String, date: String, amount: Number }],
  size40mm: [{ unit: String, date: String, amount: Number }],
}, { _id: false });

const brickEntrySchema = new mongoose.Schema({
  type: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  date: { type: String, default: '' },
}, { _id: false });

const cementEntrySchema = new mongoose.Schema({
  brand: { type: String, default: '' },
  bagRate: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  date: { type: String, default: '' },
}, { _id: false });

const steelEntrySchema = new mongoose.Schema({
  size: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  date: { type: String, default: '' },
}, { _id: false });

const equipmentSchema = new mongoose.Schema({
  jcb: [{ hours: Number, rate: Number, amount: Number, date: String }],
  dozer: [{ hours: Number, rate: Number, amount: Number, date: String }],
  driller: [{ hours: Number, rate: Number, amount: Number, date: String }],
}, { _id: false });

const masonWorkSchema = new mongoose.Schema({
  floor: { type: String, default: '' },
  foundation: { type: Number, default: 0 },
  matConcrete: { type: Number, default: 0 },
  pillar: { type: Number, default: 0 },
  plinthBeam: { type: Number, default: 0 },
  lintel: { type: Number, default: 0 },
  roof: { type: Number, default: 0 },
}, { _id: false });

const fitterSchema = new mongoose.Schema({
  advance: { type: Number, default: 0 },
  earthBeam: { type: Number, default: 0 },
  base: { type: Number, default: 0 },
  pillar: { type: Number, default: 0 },
  lintel: { type: Number, default: 0 },
  roof: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
}, { _id: false });

const electricianWorkSchema = new mongoose.Schema({
  date: { type: String, default: '' },
  work: { type: String, default: '' },
  amount: { type: Number, default: 0 },
}, { _id: false });

const plumberWorkSchema = new mongoose.Schema({
  date: { type: String, default: '' },
  work: { type: String, default: '' },
  amount: { type: Number, default: 0 },
}, { _id: false });

const painterWorkSchema = new mongoose.Schema({
  advance: { type: Number, default: 0 },
  dailyWorks: [{ date: String, work: String, amount: Number }],
}, { _id: false });

const carpenterSchema = new mongoose.Schema({
  sqFt: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false });

const tilesSchema = new mongoose.Schema({
  layer: { type: Number, default: 0 },
  helper: { type: Number, default: 0 },
  area: { type: String, default: '' },
}, { _id: false });

const welderSchema = new mongoose.Schema({
  weight: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false });

const freightSchema = new mongoose.Schema({
  month: { type: String, default: '' },
  amount: { type: Number, default: 0 },
}, { _id: false });

const advanceSchema = new mongoose.Schema({
  amount: { type: Number, default: 0 },
  date: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { timestamps: true });

const buildingApprovalItemSchema = new mongoose.Schema({
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  amount: { type: Number, default: 0 },
  date: { type: String, default: '' },
  time: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { _id: false });

const buildingSchema = new mongoose.Schema({
  buildingName: { type: String, required: true },
  partyName: { type: String, default: '' },
  mobile: { type: String, default: '' },
  address: { type: String, default: '' },
  totalAmount: { type: Number, default: 0 },
  advanceAvailable: { type: String, enum: ['Yes', 'No'], default: 'No' },
  advanceAmount: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  buildingType: { type: String, default: '' },
  advances: [advanceSchema],

  clientName: { type: String, default: '' },
  siteAddress: { type: String, default: '' },
  landId: { type: mongoose.Schema.Types.ObjectId, ref: 'Land', default: null },
  floors: { type: Number, default: 0 },
  buildingArea: { type: String, default: '' },

  agreementDetails: { type: String, default: '' },
  constructionProgress: { type: Number, default: 0 },
  totalExpense: { type: Number, default: 0 },
  totalReceivedPayment: { type: Number, default: 0 },

  // Status workflow
  status: {
    type: String,
    enum: ['New', 'Processing', 'Completed'],
    default: 'New',
  },
  projectAmount: { type: Number, default: 0 },
  completedDate: { type: String, default: '' },

  // Building approvals (VST, UDG, Plan)
  approvals: {
    vst: { type: buildingApprovalItemSchema, default: () => ({}) },
    udg: { type: buildingApprovalItemSchema, default: () => ({}) },
    plan: { type: buildingApprovalItemSchema, default: () => ({}) },
  },

  // Construction module (kept for backward compat)
  party: { type: partyConstructionSchema, default: () => ({}) },
  plotter: { type: plotterSchema, default: () => ({}) },
  structural: { type: structuralSchema, default: () => ({}) },
  pooja: { type: poojaSchema, default: () => ({}) },
  bore: { type: boreSchema, default: () => ({}) },
  storeRoom: { type: storeRoomSchema, default: () => ({}) },
  ebConstruction: { type: ebConstructionSchema, default: () => ({}) },
  sand: { type: sandSchema, default: () => ({}) },
  aggregate: { type: aggregateSchema, default: () => ({}) },
  bricks: [brickEntrySchema],
  cement: [cementEntrySchema],
  steel: [steelEntrySchema],
  equipment: { type: equipmentSchema, default: () => ({}) },
  masonWork: [masonWorkSchema],
  fitter: { type: fitterSchema, default: () => ({}) },
  electricianWorks: [electricianWorkSchema],
  plumberWorks: [plumberWorkSchema],
  painter: { type: painterWorkSchema, default: () => ({}) },
  carpenter: { type: carpenterSchema, default: () => ({}) },
  tiles: { type: tilesSchema, default: () => ({}) },
  welder: { type: welderSchema, default: () => ({}) },
  freight: [freightSchema],

  udgConnectionWork: { type: Number, default: 0 },
  gift: { type: Number, default: 0 },
  sathakka: { type: Number, default: 0 },

  // Labour list
  labourList: [{ type: { label: String, count: Number }, default: [] }],

  // Relations
  employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  vendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],

  // Materials summary
  materialsSummary: {
    purchased: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
  },

  // Daily updates
  dailyUpdates: [{
    date: { type: String, default: '' },
    note: { type: String, default: '' },
  }],

  remarks: [{ text: String, date: String, author: String }],
}, { timestamps: true });

buildingSchema.methods.computeStatus = function () {
  // Never auto-revert from Completed or Processing — only manual action
  if (this.status === 'Completed' || this.status === 'Processing') return;

  const anySectionModified =
    this.approvals?.vst?.status !== 'Pending' ||
    this.approvals?.udg?.status !== 'Pending' ||
    this.approvals?.plan?.status !== 'Pending' ||
    this.advances?.length > 0 ||
    this.employeeIds?.length > 0 ||
    this.vendorIds?.length > 0;

  if (anySectionModified) {
    this.status = 'Processing';
  }
};

buildingSchema.pre('save', function (next) {
  this.computeStatus();
  next();
});

module.exports = mongoose.model('Building', buildingSchema);
