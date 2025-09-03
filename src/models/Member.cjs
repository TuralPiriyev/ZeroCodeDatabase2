const mongoose = require('mongoose');
const { Schema } = mongoose;

const MemberSchema = new Schema({
  workspaceId: String,
  // Optional link to Users._id when available
  userId: String,
  id: String,
  username: String,
  role: { type: String, enum: ['owner','editor','viewer'] },
  joinedAt: Date,
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Member', MemberSchema);

// Add indexes for faster queries
MemberSchema.index({ workspaceId: 1 });
MemberSchema.index({ username: 1 });
MemberSchema.index({ userId: 1 });
MemberSchema.index({ role: 1 });
