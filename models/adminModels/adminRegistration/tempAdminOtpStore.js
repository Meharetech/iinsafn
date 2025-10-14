const mongoose = require("mongoose");

const adminOtpSchema = new mongoose.Schema({
  name: String,
  email: String,
  mobileNumber: String,
  password: String,
  emailOtp: String,
  mobileOtp: String,
  assignedSections: [String],  // ✅ Must be an array
  accessPaths: [String],       // ✅ Must be an array
  expiresAt: Date
}, { timestamps: true });

module.exports = mongoose.model("AdminOtp", adminOtpSchema);
