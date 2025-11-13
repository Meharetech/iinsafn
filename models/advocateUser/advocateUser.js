const mongoose = require("mongoose");

const advocateUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phoneNo: {
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
      required: true,
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
    residenceAddress: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    specialization: {
      type: String,
      required: true,
      enum: [
        "Civil law",
        "Criminal law",
        "Family law",
        "Corporate/company law",
        "Tax law",
        "Consumer law",
        "Cyber law",
        "IPR law",
        "Labour & employment law",
        "Real Estate/RERA",
        "Arbitration & Mediation",
        "Constitutional/writ practice",
        "High court practice",
        "Supreme court practice"
      ],
    },
    experience: {
      type: Number,
      required: true,
      min: 1,
      max: 25,
    },
    barAssociationCourt: {
      type: String,
      required: true,
    },
    uniqueId: {
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
    advocateId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

const AdvocateUser = mongoose.model("AdvocateUser", advocateUserSchema);
module.exports = AdvocateUser;

