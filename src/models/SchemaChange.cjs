const mongoose = require('mongoose');

const schemaChangeSchema = new mongoose.Schema({
  schemaId: {
    type: String,
    required: true,
    index: true
  },
  changeType: {
    type: String,
    required: true,
    enum: ['table_created', 'table_updated', 'table_deleted', 'relationship_added', 'relationship_removed']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient querying
schemaChangeSchema.index({ schemaId: 1, timestamp: -1 });
schemaChangeSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('SchemaChange', schemaChangeSchema);