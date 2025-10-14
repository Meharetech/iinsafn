const mongoose = require("mongoose");

const ryvSchema = new mongoose.Schema({
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
  dateOfBirth: String,
  state: String,
  city: String,
  residenceAddress: String,
  pincode: Number,
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
  isVerified: {
    type: Boolean,
    default: false,
  },
  whatsappOtp: String,
  emailOtp: String,
  loginOtp: String,
  otpExpiry: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Correct TTL index: deletes only unverified users after 10 minutes
ryvSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 600, // 10 minutes
    partialFilterExpression: { isVerified: false },
  }
);

const ryvUser = mongoose.model("ryvUser", ryvSchema);
module.exports = ryvUser;
