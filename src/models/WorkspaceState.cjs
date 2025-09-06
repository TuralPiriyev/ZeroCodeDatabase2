const mongoose = require('mongoose');

const WorkspaceStateSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, unique: true, index: true },
  state: { type: Buffer },
  version: { type: Number, default: 0 },
  lastModified: { type: Date, default: Date.now },
  shared: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WorkspaceState', WorkspaceStateSchema);
