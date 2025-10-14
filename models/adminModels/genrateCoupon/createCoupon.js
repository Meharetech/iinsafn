const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  discount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'flat'],
    lowercase: true
  },
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number,
    required: true
  },
  minPurchase: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive'],
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  usedCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model("Coupon", couponSchema);
