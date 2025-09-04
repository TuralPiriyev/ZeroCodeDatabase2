const mongoose = require('mongoose');
const { Schema } = mongoose;

const SharedSchema = new Schema({
  workspaceId: { type: String, required: true },
  schemaId: { type: String, required: true },
  name: { type: String, required: true },
  // store canonical schema payload as string (JSON) or Buffer if preferred
  scripts: { type: String },
  docState: { type: Buffer },
  version: { type: Number, default: 0 },
  lastModified: { type: Date, default: Date.now },
  shared: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure uniqueness per workspace+schema
SharedSchema.index({ workspaceId: 1, schemaId: 1 }, { unique: true });

module.exports = mongoose.model('SharedSchema', SharedSchema);
