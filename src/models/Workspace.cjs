const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkspaceSchema = new Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => require('uuid').v4()
  },
  name: { 
    type: String, 
    required: true 
  },
  ownerId: { 
    type: String, 
    required: true 
  },
  members: [{
    username: { 
      type: String, 
      required: true 
    },
    role: { 
      type: String, 
      enum: ['owner', 'editor', 'viewer'], 
      required: true 
    },
    joinedAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  sharedSchemas: [{
    schemaId: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    scripts: { 
      type: String, 
      required: true 
    },
    lastModified: { 
      type: Date, 
      default: Date.now 
    }
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Indexes for performance
WorkspaceSchema.index({ id: 1 });
WorkspaceSchema.index({ ownerId: 1 });
WorkspaceSchema.index({ 'members.username': 1 });
WorkspaceSchema.index({ isActive: 1 });

// Transform toJSON to ensure dates are ISO strings
WorkspaceSchema.set('toJSON', {
  transform: function(doc, ret) {
    // Convert all Date objects to ISO strings
    if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
    if (ret.updatedAt instanceof Date) ret.updatedAt = ret.updatedAt.toISOString();
    
    // Transform members array
    if (ret.members && Array.isArray(ret.members)) {
      ret.members = ret.members.map(member => ({
        ...member,
        joinedAt: member.joinedAt instanceof Date ? member.joinedAt.toISOString() : member.joinedAt
      }));
    }
    
    // Transform sharedSchemas array
    if (ret.sharedSchemas && Array.isArray(ret.sharedSchemas)) {
      ret.sharedSchemas = ret.sharedSchemas.map(schema => ({
        ...schema,
        lastModified: schema.lastModified instanceof Date ? schema.lastModified.toISOString() : schema.lastModified
      }));
    }
    
    return ret;
  }
});

// Pre-save middleware to update timestamps
WorkspaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Workspace', WorkspaceSchema);