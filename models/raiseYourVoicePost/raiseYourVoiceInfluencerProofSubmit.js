const mongoose = require("mongoose");

const influencerProofSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "ryvPost", required: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // ✅ Store influencer's iinsafId directly
    iinsafId: { type: String, required: true },

    // Proof fields (optional until proof is uploaded)
    videoLink: { type: String, default: "" },
    platform: { type: String, default: "" },
    duration: { type: String, default: "" },

    // Proof workflow
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "running", "completed"],
      default: "pending"
    },
    proof: { type: Boolean, default: false },

    rejectionNote: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

// Ensure one influencer interacts with one ad only once
influencerProofSchema.index({ adId: 1, influencerId: 1 }, { unique: true });

module.exports = mongoose.model("RaiseYourVoiceInfluencerProof", influencerProofSchema);
