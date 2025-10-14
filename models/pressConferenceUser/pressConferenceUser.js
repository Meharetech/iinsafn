const mongoose = require("mongoose");

const pressConferenceUserSchema = new mongoose.Schema(
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
    residenceaddress: {
      type: String,
    },
    state: {
      type: String,
    },
    city: {
      type: String,
    },
    pincode: {
      type: Number,
    },
    password: {
      type: String,
      required: true,
    },
    mobileOtp: {
      type: String,
    },
    emailOtp: {
      type: String,
    },
    isVerified: { 
      type: Boolean, 
      default: false 
    },
    otpExpiry: {
      type: Date,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    resetOTP: {
      type: String,
    },
    resetOTPExpires: {
      type: Date,
    },
    pressConferenceId: {
      type: String,
      unique: true,
      sparse: true,
    },
    organization: {
      type: String,
      required: false,
    },
    designation: {
      type: String,
      required: false,
    },
    mediaType: {
      type: String,
      enum: ["Print", "Digital", "TV", "Radio", "Online", "Other"],
      required: false,
    },
  },
  { timestamps: true }
);

const PressConferenceUser = mongoose.model("PressConferenceUser", pressConferenceUserSchema);
module.exports = PressConferenceUser;
