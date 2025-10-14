const mongoose = require("mongoose");

const freeAdsSchema = new mongoose.Schema(
  {
    adType: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    description: {
      type: String,
    },
    state: [
      {
        type: String,
      },
    ],
    city: [
      {
        type: String,
      },
    ],
    allState: {
      type: Boolean,
      default: false,
    },
    userType: {
      type: String,
      enum: ["reporter", "influencer", "both"],
      default: "reporter",
    },
    requiredReportersCount: { type: Number, default: 0 },

    // ✅ All users selected for this ad (reporters + influencers)
    selectedReporters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ✅ Separate tracking for reporters and influencers
    reportersIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    influencersIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ✅ Per-reporter status tracking
    acceptedReporters: [
      {
        reporterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        iinsafId: {
          type: String,
        },
        postStatus: {
          type: String,
          enum: ["pending", "accepted", "submitted", "completed"],
          default: "pending",
        },
        acceptedAt: {
          type: Date,
        },
        completedAt: {
          type: Date,
        },
        submittedAt: {
          type: Date,
        },
        // ✅ New field for storing ad proof
        adProof: {
          type: String, // could be a URL to image/video proof
        },
        // ✅ Admin rejection fields
        rejectNote: {
          type: String,
          default: "",
        },
        rejectedAt: {
          type: Date,
        },
        adminRejectNote: {
          type: String,
          default: "",
        },
      },
    ],

    // ✅ Overall ad status
    status: {
      type: String,
      enum: ["approved", "running", "completed", "modified"],
      default: "approved",
    },
  },
  { timestamps: true } // ✅ This adds createdAt & updatedAt automatically
);

module.exports = mongoose.model("freeAdModel", freeAdsSchema);
