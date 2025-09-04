const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkspaceSchema = new Schema({
  workspaceId: { type: String, required: true, unique: true },
  // Store Yjs encoded state as Buffer (preferred) or base64 string
  docState: { type: Buffer },
  version: { type: Number, default: 0 },
  lastModified: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('WorkspaceSchema', WorkspaceSchema);
