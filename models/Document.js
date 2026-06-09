const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  module: { type: String, default: 'pdfUpload' },
  referenceId: { type: String, default: 'general' },
  documentType: { type: String, default: 'General' },
  name: { type: String, required: true },
  storedName: { type: String, required: true },
  filePath: { type: String, required: true },
  uri: { type: String, required: true },
  mimeType: { type: String, default: 'application/pdf' },
  size: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  uploadedAt: { type: String, default: () => new Date().toISOString() },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

documentSchema.index({ module: 1, referenceId: 1, uploadedAt: -1 });

module.exports = mongoose.model('Document', documentSchema);