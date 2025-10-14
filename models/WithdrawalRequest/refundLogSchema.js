const mongoose = require("mongoose");

const refundLogSchema = new mongoose.Schema(
  {
    refundId: { type: String, unique: true },
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Adpost" },
    advertiserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    advertiserName: String,
    refundAmount: Number,
    reason: String,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RefundLog", refundLogSchema);
