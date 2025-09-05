const mongoose = require('mongoose');
const { Schema } = mongoose;

const DbSchema = new Schema({
  name: { type: String, required: true },
  tables: { type: String },
  relationships: { type: String },
  ownerUserId: { type: String },
  isShared: { type: Boolean, default: false },
  teamId: { type: String, index: true },
  sharedId: { type: String, sparse: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// unique sparse index on sharedId so only shared docs need it
DbSchema.index({ sharedId: 1 }, { unique: true, sparse: true });

// Pre-save update timestamp
DbSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Schema', DbSchema);
