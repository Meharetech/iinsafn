const mongoose = require("mongoose");

const podcastUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'other']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  phoneNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
  },
  aadharNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\d{12}$/, 'Aadhar number must be exactly 12 digits']
  },
  dateOfBirth: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        const today = new Date();
        const age = today.getFullYear() - value.getFullYear();
        const monthDiff = today.getMonth() - value.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < value.getDate())) {
          return age - 1 >= 13;
        }
        return age >= 13;
      },
      message: 'You must be at least 13 years old to register'
    }
  },
  pancard: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]{10}$/, 'PAN card must be 10 characters with 4 digits and 6 letters'],
    validate: {
      validator: function(value) {
        const digitCount = (value.match(/\d/g) || []).length;
        const letterCount = (value.match(/[A-Z]/g) || []).length;
        return digitCount === 4 && letterCount === 6;
      },
      message: 'PAN card must have exactly 4 digits and 6 uppercase letters'
    }
  },
  residenceAddress: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  city: {
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
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    default: 'podcastuser',
    enum: ['podcastuser', 'podcastadmin']
  },
  profileImage: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  socialLinks: {
    website: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' }
  },
  podcastStats: {
    totalEpisodes: { type: Number, default: 0 },
    totalListeners: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 }
  },
  lastLogin: {
    type: Date,
    default: null
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

// Index for better query performance (unique fields already have indexes from unique: true)
podcastUserSchema.index({ isVerified: 1 });
podcastUserSchema.index({ isActive: 1 });

// Pre-save middleware to update updatedAt
podcastUserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to get user's full address
podcastUserSchema.methods.getFullAddress = function() {
  return `${this.residenceAddress}, ${this.city}, ${this.state} - ${this.pincode}`;
};

// Method to check if user is eligible for podcast creation
podcastUserSchema.methods.canCreatePodcast = function() {
  return this.isVerified && this.isActive;
};

// Static method to find active users
podcastUserSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isVerified: true });
};

module.exports = mongoose.model('PodcastUser', podcastUserSchema);

