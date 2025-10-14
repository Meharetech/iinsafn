const express = require("express");
const router = express.Router();
const {
  sendOtpForPasswordReset,
  verifyOtpForPasswordReset,
  resetPassword,
  resendOtpForPasswordReset
} = require("../../controller/pressConference/pressForgetPasswordController");

// Send OTP for password reset
router.post("/forget-password/send-otp", sendOtpForPasswordReset);

// Verify OTP for password reset
router.post("/forget-password/verify-otp", verifyOtpForPasswordReset);

// Reset password
router.post("/forget-password/reset-password", resetPassword);

// Resend OTP for password reset
router.post("/forget-password/resend-otp", resendOtpForPasswordReset);

module.exports = router;
