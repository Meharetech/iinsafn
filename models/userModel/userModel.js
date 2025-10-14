const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    dateOfBirth: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      required: true,
      enum: ["Advertiser", "Influencer", "Reporter"],
      default: "Advertiser",
    },
    password: {
      type: String,
      require: true,
    },
    state: {
      type: String,
    },
    city: {
      type: String,
    },
    residenceaddress: {
      type: String,
    },
    pincode: {
      type: Number,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    aadharNo: {
      type: String,
      required: true,
    },
    pancard: {
      type: String,
      required: true,
    },
    bloodType: {
      type: String,
      required: true,
    },
    mobileOtp: {
      type: String,
    },
    emailOtp: {
      type: String,
    },
    isVerified: { type: Boolean, default: false },
    otpExpiry: {
      type: Date,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    verifiedReporter: {
      type: Boolean,
      default: false,
    },
    resetOTP: {
      type: String,
    },
    resetOTPExpires: {
      type: Date,
    },
    iinsafId: {
      type: String,
      unique: true,
      sparse: true, // allows null values for reporters
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
