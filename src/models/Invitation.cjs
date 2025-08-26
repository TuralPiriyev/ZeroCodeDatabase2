const mongoose = require('mongoose');
const { Schema } = mongoose;

const InvitationSchema = new Schema({
  workspaceId: String,
  inviterUsername: String,
  inviteeUsername: String,
  role: { type: String, enum: ['editor','viewer'] },
  joinCode: String,
  createdAt: Date,
  expiresAt: Date,
  status: { type: String, enum: ['pending','accepted','expired'], default: 'pending' },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Invitation', InvitationSchema);

// Add index for faster queries
InvitationSchema.index({ joinCode: 1 });
InvitationSchema.index({ workspaceId: 1 });
InvitationSchema.index({ status: 1 });
InvitationSchema.index({ expiresAt: 1 });
