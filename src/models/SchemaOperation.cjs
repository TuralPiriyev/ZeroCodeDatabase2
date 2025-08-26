const mongoose = require('mongoose');

const schemaOperationSchema = new mongoose.Schema({
  schemaId: {
    type: String,
    required: true,
    index: true
  },
  operation: {
    type: String,
    required: true
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
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient querying
schemaOperationSchema.index({ schemaId: 1, timestamp: -1 });
schemaOperationSchema.index({ userId: 1, timestamp: -1 });
schemaOperationSchema.index({ operation: 1, timestamp: -1 });

module.exports = mongoose.model('SchemaOperation', schemaOperationSchema);