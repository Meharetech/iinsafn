const mongoose = require("mongoose");

const freeAdProofSchema = new mongoose.Schema({
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "freeAdModel",
    required: true,
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  iinsafId: {
    type: String,  // ✅ store reporter’s iinsafId directly
    required: true,
  },
  screenshot: {
    type: String, // Will store the file path or URL
    required: true,
  },
  channelName: {
    type: String,
    required: true,
  },
  videoLink: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    required: true,
  },
  duration: {
    type: String, // or Number if you want to store numeric seconds/minutes
    required: true,
  },
  adminRejectNote: {
      type: String,
      default: "",
    },
  status: {
    type: String,
    enum: ["submitted", "approved", "rejected","completed"],
    default: "submitted",
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("FreeAdProof", freeAdProofSchema);
