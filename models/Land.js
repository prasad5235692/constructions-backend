const mongoose = require('mongoose');

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function hasApprovalDetails(item) {
  return item?.status === 'Completed'
    && hasPositiveNumber(item.amount)
    && hasText(item.approvedDate)
    && hasText(item.approvedTime);
}

function hasCleaningDetails(item) {
  return item?.status === 'Completed'
    && hasPositiveNumber(item.hours)
    && hasPositiveNumber(item.hourRate)
    && hasPositiveNumber(item.amount);
}

function hasLineItemDetails(item) {
  return hasText(item?.unit)
    && hasPositiveNumber(item.rate)
    && hasPositiveNumber(item.amount);
}

function hasDocumentDetails(item) {
  return hasText(item?.date) && hasText(item?.documentNumber);
}

function hasMarkedCompleted(item, requiredFields = []) {
  if (item?.status !== 'Completed') {
    return false;
  }

  return requiredFields.every((field) => {
    const value = item?.[field];
    return typeof value === 'number' ? hasPositiveNumber(value) : hasText(value);
  });
}

const advanceSchema = new mongoose.Schema({
  amount: { type: Number, default: 0 },
  date: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { timestamps: true });

const approvalItemSchema = new mongoose.Schema({
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  amount: { type: Number, default: 0 },
  approvedDate: { type: String, default: '' },
  approvedTime: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { _id: false });

const cleaningItemSchema = new mongoose.Schema({
  hours: { type: Number, default: 0 },
  hourRate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  padiAllowance: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
}, { _id: false });

const gravelRubbishItemSchema = new mongoose.Schema({
  unit: { type: String, default: '' },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false });

const roadWorkItemSchema = new mongoose.Schema({
  unit: { type: String, default: '' },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false });

const compoundItemSchema = new mongoose.Schema({
  rate: { type: Number, default: 0 },
  sqFt: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false });

const fencingItemSchema = new mongoose.Schema({
  quantity: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false });

const offlineAdSchema = new mongoose.Schema({
  notice: { type: Number, default: 0 },
  flex: { type: Number, default: 0 },
  sunPack: { type: Number, default: 0 },
}, { _id: false });

const onlineAdSchema = new mongoose.Schema({
  digitalMarketing: { type: Number, default: 0 },
  facebook: { type: Number, default: 0 },
  instagram: { type: Number, default: 0 },
  whatsapp: { type: Number, default: 0 },
  youtube: { type: Number, default: 0 },
}, { _id: false });

const landSaleSchema = new mongoose.Schema({
  customerName: { type: String, default: '' },
  mobileNumber: { type: String, default: '' },
  plotNumber: { type: String, default: '' },
  saleAmount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  saleDate: { type: String, default: '' },
  status: { type: String, enum: ['Available', 'Reserved', 'Sold'], default: 'Available' },
});

const historyLogSchema = new mongoose.Schema({
  section: { type: String, default: '' },
  field: { type: String, default: '' },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  updatedBy: { type: String, default: '' },
  updatedDate: { type: String, default: '' },
}, { _id: false });

const landSchema = new mongoose.Schema({
  landName: { type: String, required: true },
  partyName: { type: String, default: '' },
  mobile: { type: String, default: '' },
  address: { type: String, default: '' },
  landArea: { type: String, default: '' },
  totalAmount: { type: Number, default: 0 },
  advanceAvailable: { type: String, enum: ['Yes', 'No'], default: 'No' },
  advanceAmount: { type: Number, default: 0 },
  createdDate: { type: String, default: '' },
  advances: [advanceSchema],

  document: {
    date: { type: String, default: '' },
    documentNumber: { type: String, default: '' },
    uploadDocument: { type: String, default: '' },
  },

  previousDocument: {
    date: { type: String, default: '' },
    documentNumber: { type: String, default: '' },
    uploadDocument: { type: String, default: '' },
  },

  legalOpinion: {
    advocateName: { type: String, default: '' },
    opinionDetails: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    date: { type: String, default: '' },
    uploadFile: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  registration: {
    date: { type: String, default: '' },
    guidanceValue: { type: Number, default: 0 },
    marketValue: { type: Number, default: 0 },
    registrationExpenses: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  brokerCommission: {
    brokerName: { type: String, default: '' },
    commissionAmount: { type: Number, default: 0 },
    date: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  approvals: {
    dtcp: { type: approvalItemSchema, default: () => ({}) },
    localBodies: { type: approvalItemSchema, default: () => ({}) },
    rera: { type: approvalItemSchema, default: () => ({}) },
  },

  cleaning: {
    jcb: { type: cleaningItemSchema, default: () => ({}) },
    dozer: { type: cleaningItemSchema, default: () => ({}) },
  },

  survey: {
    surveyNumber: { type: String, default: '' },
    surveyDate: { type: String, default: '' },
    surveyCost: { type: Number, default: 0 },
    surveyNotes: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  fieldWork: {
    gravel: { type: gravelRubbishItemSchema, default: () => ({}) },
    rubbish: { type: gravelRubbishItemSchema, default: () => ({}) },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  roadWork: {
    gravel: { type: roadWorkItemSchema, default: () => ({}) },
    rubbish: { type: roadWorkItemSchema, default: () => ({}) },
    wetMix: { type: roadWorkItemSchema, default: () => ({}) },
    tar: { type: roadWorkItemSchema, default: () => ({}) },
    vehicleFreightCharges: { type: Number, default: 0 },
    labourCharges: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  ebWork: {
    applicationCharges: { type: Number, default: 0 },
    registrationCharges: { type: Number, default: 0 },
    postEstimationCharges: { type: Number, default: 0 },
    formalitiesCharges: { type: Number, default: 0 },
    freightCharges: { type: Number, default: 0 },
    labourCharges: { type: Number, default: 0 },
    streetLightBill: { type: Number, default: 0 },
    streetLightFittingCharges: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  compound: {
    readymadeCompound: { type: compoundItemSchema, default: () => ({}) },
    readymadeFencing: { type: fencingItemSchema, default: () => ({}) },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  plotStone: {
    quantity: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  advertisement: {
    offline: { type: offlineAdSchema, default: () => ({}) },
    online: { type: onlineAdSchema, default: () => ({}) },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },

  sales: [landSaleSchema],
  history: [historyLogSchema],

  status: {
    type: String,
    enum: ['New', 'Processing', 'Completed'],
    default: 'New',
  },
}, { timestamps: true });

landSchema.methods.computeStatus = function () {
  const dtcpOk = hasApprovalDetails(this.approvals?.dtcp);
  const localOk = hasApprovalDetails(this.approvals?.localBodies);
  const reraOk = hasApprovalDetails(this.approvals?.rera);

  const anySectionModified =
    this.legalOpinion?.status !== 'Pending' ||
    this.registration?.status !== 'Pending' ||
    this.brokerCommission?.status !== 'Pending' ||
    this.approvals?.dtcp?.status !== 'Pending' ||
    this.approvals?.localBodies?.status !== 'Pending' ||
    this.approvals?.rera?.status !== 'Pending' ||
    this.cleaning?.jcb?.status !== 'Pending' ||
    this.cleaning?.dozer?.status !== 'Pending' ||
    this.survey?.status !== 'Pending' ||
    this.fieldWork?.status !== 'Pending' ||
    this.roadWork?.status !== 'Pending' ||
    this.ebWork?.status !== 'Pending' ||
    this.compound?.status !== 'Pending' ||
    this.plotStone?.status !== 'Pending' ||
    this.advertisement?.status !== 'Pending';

  if (dtcpOk && localOk && reraOk) {
    this.status = 'Completed';
  } else if (anySectionModified) {
    this.status = 'Processing';
  } else {
    this.status = 'New';
  }
};

landSchema.pre('save', function (next) {
  this.computeStatus();
  next();
});

module.exports = mongoose.model('Land', landSchema);
