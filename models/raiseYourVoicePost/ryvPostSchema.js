const mongoose = require("mongoose");

const ryvPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ryvUser",
      required: true,
    },
    name: { type: String, required: true },
    phoneNo: { type: String, required: true },
    email: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    residenceAddress: { type: String, required: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    aadharNo: { type: String, required: true },
    pancard: { type: String, required: true },
    description: { type: String, required: true },
    targetUserType: { 
      type: String, 
      enum: ["reporter", "influencer", "both"], 
      default: "reporter",
      required: true 
    },

    // Media fields
    image: { type: String },
    video: { type: String },

    // Post status
    status: {
      type: String,
      enum: ["under review", "approved", "accepted", "completed", "rejected", "modified"],
      default: "under review",
    },

    rejectionNote: {
      type: String,
      default: "",
    },

    // Admin modification fields
    adminSelectState: {
      type: [String],
      default: [],
    },
    adminSelectCities: {
      type: [String], 
      default: [],
    },
    adminSelectPincode: {
      type: String,
      default: "",
    },
    reporterId: {
      type: [String],
      default: [],
    },
    allStates: {
      type: Boolean,
      default: false,
    },

    // Modification tracking
    modifiedAt: {
      type: Date,
    },

    // Admin action tracking
    adminAction: {
      action: {
        type: String,
        enum: ["approved", "rejected", "modified"],
      },
      note: String,
      modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
      actionDate: Date,
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("ryvPost", ryvPostSchema);
