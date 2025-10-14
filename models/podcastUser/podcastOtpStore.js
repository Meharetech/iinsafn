const mongoose = require("mongoose");

const podcastOtpStoreSchema = new mongoose.Schema({
  phoneNo: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  emailOtp: {
    type: String,
    required: true,
    length: 6
  },
  whatsappOtp: {
    type: String,
    required: true,
    length: 6
  },
  otpType: {
    type: String,
    required: true,
    enum: ['registration', 'login', 'forgot-password'],
    default: 'registration'
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 3 * 60 * 1000) // 3 minutes from now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
podcastOtpStoreSchema.index({ phoneNo: 1, email: 1 });
podcastOtpStoreSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save middleware to set expiration time
podcastOtpStoreSchema.pre('save', function(next) {
  if (this.isNew) {
    this.expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
  }
  next();
});

// Method to check if OTP is valid and not expired
podcastOtpStoreSchema.methods.isValid = function() {
  return !this.isUsed && this.expiresAt > new Date();
};

// Method to mark OTP as used
podcastOtpStoreSchema.methods.markAsUsed = function() {
  this.isUsed = true;
  return this.save();
};

// Static method to find valid OTP
podcastOtpStoreSchema.statics.findValidOtp = function(phoneNo, email, otpType = 'registration') {
  return this.findOne({
    phoneNo,
    email,
    otpType,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to clean expired OTPs
podcastOtpStoreSchema.statics.cleanExpiredOtps = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isUsed: true }
    ]
  });
};

module.exports = mongoose.model('PodcastOtpStore', podcastOtpStoreSchema);

