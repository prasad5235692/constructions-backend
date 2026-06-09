const mongoose = require('mongoose');

const remarkSchema = new mongoose.Schema({
  module: { type: String, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorRole: { type: String, default: '' },
  authorName: { type: String, default: '' },
  date: { type: String, default: '' },
  text: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Remark', remarkSchema);
