const mongoose = require('mongoose');

const podcastBookingSchema = new mongoose.Schema({
  // Basic Booking Details
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  
  // Podcast Information
  topic: {
    type: String,
    required: true,
    trim: true
  },
  podcastTitle: {
    type: String,
    required: true,
    trim: true
  },
  podcastDescription: {
    type: String,
    trim: true
  },
  
  // Guest Information
  guestName: {
    type: String,
    trim: true
  },
  guestEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  guestPhone: {
    type: String,
    trim: true
  },
  
  // Contact Information
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  contactPhone: {
    type: String,
    required: true,
    trim: true
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  companyName: {
    type: String,
    trim: true
  },
  
  // Additional Details
  notes: {
    type: String,
    trim: true
  },
  
  // Booking Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  
  // User who made the booking
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PodcastUser',
    required: true
  },
  
  // Admin fields
  adminNotes: {
    type: String,
    default: ''
  },
  confirmedAt: {
    type: Date
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  cancellationReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better query performance
podcastBookingSchema.index({ userId: 1 });
podcastBookingSchema.index({ status: 1 });
podcastBookingSchema.index({ date: 1 });
podcastBookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PodcastBooking', podcastBookingSchema);
