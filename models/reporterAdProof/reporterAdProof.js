const mongoose = require("mongoose");

const proofSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  iinsafId: {
    type: String,
    required: true,
  },
  screenshot: {
    type: String,
    required: true,
  },
  completedTaskScreenshot: {
    type: String,
    default: ""
  },
  channelName: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    required: true,
  },
  videoLink: {
    type: String,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  status: { 
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'completed'],
    default: 'submitted'
  },
  adminRejectNote: {
    type: String,
    default: ""
  },
  userRole: {
    type: String,
    enum: ["Reporter", "Influencer"],
  },
});

const reporterAdProofSchema = new mongoose.Schema({
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Adpost",
    required: true,
    unique: true, // ensure one document per ad
  },
  proofs: [proofSchema],
  baseView: Number,
  finalReporterPrice: Number,
  adType: String,
  runningAdStatus: {
    type: String,
    enum: ["running", "completed"],
  },
  requiredReporter: {
    type: Number, // or the correct type used in your Adpost
    required: true,
  },
});

module.exports = mongoose.model("ReporterAdProof", reporterAdProofSchema);
