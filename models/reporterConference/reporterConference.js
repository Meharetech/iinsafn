const mongoose = require("mongoose");

const reporterConferenceSchema = new mongoose.Schema({
  conferenceId: {
    type: String,
    required: true,
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  iinsafId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "completed"],
    default: "pending",
  },
  acceptedAt: {
    type: Date,
  },
  rejectedAt: {
    type: Date,
  },
  rejectNote: {
    type: String,
    default: "",
  },
  completedAt: {
    type: Date,
  },
  proofSubmitted: {
    type: Boolean,
    default: false,
  },
  proofDetails: {
    channelName: String,
    platform: String,
    videoLink: String,
    duration: String,
    screenshot: String,
    submittedAt: Date,
    adminRejectNote: {
      type: String,
      default: "",
    },
    rejectedAt: {
      type: Date,
    },
  },
  // Store complete conference details for easy access
  conferenceDetails: {
    topic: String,
    purpose: String,
    conferenceDate: String,
    conferenceTime: String,
    timePeriod: String,
    state: String,
    city: String,
    place: String,
    landmark: String,
    adminNote: String,
    submittedBy: {
      name: String,
      email: String,
      organization: String,
      pressConferenceId: String,
    },
  },
}, {
  timestamps: true,
});

// Create compound unique index to prevent duplicate reporter-conference combinations
reporterConferenceSchema.index({ conferenceId: 1, reporterId: 1 }, { unique: true });

module.exports = mongoose.model("ReporterConference", reporterConferenceSchema);
