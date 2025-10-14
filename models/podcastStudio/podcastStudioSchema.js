const mongoose = require("mongoose");

const podcastStudioSchema = new mongoose.Schema({
  studioName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{6}$/, 'Pincode must be exactly 6 digits']
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  facilities: [{
    type: String,
    enum: ['wifi', 'parking', 'coffee', 'ac', 'soundproof', 'equipment', 'editing', 'storage']
  }],
  availability: {
    monday: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      available: { type: Boolean, default: false }
    },
    tuesday: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      available: { type: Boolean, default: false }
    },
    wednesday: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      available: { type: Boolean, default: false }
    },
    thursday: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      available: { type: Boolean, default: false }
    },
    friday: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      available: { type: Boolean, default: false }
    },
    saturday: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      available: { type: Boolean, default: false }
    },
    sunday: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      available: { type: Boolean, default: false }
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  images: {
    type: [String], // Cloudinary URLs
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one studio image is required'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PodcastUser',
    required: true
  },
  // Admin fields
  adminNotes: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  rejectedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
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

// Index for better query performance
podcastStudioSchema.index({ state: 1, city: 1 });
podcastStudioSchema.index({ status: 1 });
podcastStudioSchema.index({ isActive: 1 });
podcastStudioSchema.index({ ownerId: 1 });

// Pre-save middleware to update updatedAt
podcastStudioSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to get full address
podcastStudioSchema.methods.getFullAddress = function() {
  return `${this.address}, ${this.city}, ${this.state} - ${this.pincode}`;
};

// Method to check if studio is available on specific day and time
podcastStudioSchema.methods.isAvailableOn = function(day, startTime, endTime) {
  const daySchedule = this.availability[day.toLowerCase()];
  if (!daySchedule || !daySchedule.available) return false;
  
  const studioStart = daySchedule.start;
  const studioEnd = daySchedule.end;
  
  return startTime >= studioStart && endTime <= studioEnd;
};

// Static method to find studios by location
podcastStudioSchema.statics.findByLocation = function(state, city) {
  return this.find({ 
    state: new RegExp(state, 'i'), 
    city: new RegExp(city, 'i'),
    status: 'approved',
    isActive: true 
  });
};

// Static method to find available studios
podcastStudioSchema.statics.findAvailable = function() {
  return this.find({ 
    status: 'approved',
    isActive: true 
  });
};

module.exports = mongoose.model('PodcastStudio', podcastStudioSchema);
