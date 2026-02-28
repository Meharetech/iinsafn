const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { sendEmail, getPressConferenceTemplate } = require("../../utils/emailTemplates");

// Email sending function for OTP
const sendOtpViaEmail = async (email, otp, userName) => {
  try {
    const emailHtml = getPressConferenceTemplate(userName || "User", otp, "reset your password");

    await sendEmail(
      email,
      "Press Conference - Password Reset OTP",
      `Your OTP code for password reset is ${otp}. It is valid for 10 minutes.`,
      emailHtml
    );

    console.log(`✅ Password reset OTP sent to ${email}`);
    console.log(`[EMAIL OTP INFO] Sent Password Reset OTP: ${otp} to Email: ${email}`);
  } catch (error) {
    console.error("❌ Error sending password reset OTP:", error);
    throw error;
  }
};

// Send OTP for password reset
const sendOtpForPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Sending OTP for password reset for email:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Find user by email
    const user = await PressConferenceUser.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email address"
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with OTP
    user.resetOTP = otp;
    user.resetOTPExpires = otpExpires;
    await user.save();

    console.log("OTP generated for password reset:", otp);

    // Send OTP via email
    try {
      await sendOtpViaEmail(email, otp);
      console.log(`✅ Password reset OTP sent to email: ${email}`);
    } catch (emailError) {
      console.error("❌ Failed to send OTP email:", emailError);
      console.log(`🔧 DEVELOPMENT FALLBACK - OTP for ${email}: ${otp}`);

      // In development, still allow the process to continue
      // In production, you might want to return an error
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP email. Please try again."
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
      data: {
        email: email,
        otpExpires: otpExpires
      }
    });
  } catch (error) {
    console.error("Error sending OTP for password reset:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Verify OTP for password reset
const verifyOtpForPasswordReset = async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log("Verifying OTP for password reset:", { email, otp });

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    // Find user by email
    const user = await PressConferenceUser.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if OTP exists and is not expired
    if (!user.resetOTP || !user.resetOTPExpires) {
      console.log("No OTP found for user:", {
        email: user.email,
        hasResetOTP: !!user.resetOTP,
        hasResetOTPExpires: !!user.resetOTPExpires
      });
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new OTP"
      });
    }

    if (new Date() > user.resetOTPExpires) {
      console.log("OTP expired for user:", {
        email: user.email,
        otpExpires: user.resetOTPExpires,
        currentTime: new Date()
      });
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP"
      });
    }

    // Verify OTP
    console.log("Comparing OTPs:", {
      userOTP: user.resetOTP,
      providedOTP: otp,
      match: user.resetOTP === otp
    });
    if (user.resetOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    console.log("OTP verified successfully for password reset");

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        email: email,
        verified: true
      }
    });
  } catch (error) {
    console.error("Error verifying OTP for password reset:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    console.log("Resetting password for email:", email);

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, new password, and confirm password are required"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Find user by email
    const user = await PressConferenceUser.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if OTP was verified (optional additional security)
    if (!user.resetOTP || !user.resetOTPExpires) {
      return res.status(400).json({
        success: false,
        message: "Please verify OTP first"
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password and clear OTP
    user.password = hashedPassword;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    user.updatedAt = new Date();
    await user.save();

    console.log("Password reset successfully for user:", email);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
      data: {
        email: email
      }
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Resend OTP for password reset
const resendOtpForPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Resending OTP for password reset for email:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Find user by email
    const user = await PressConferenceUser.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email address"
      });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    user.resetOTP = otp;
    user.resetOTPExpires = otpExpires;
    await user.save();

    console.log("New OTP generated for password reset:", otp);

    // Send OTP via email
    try {
      await sendOtpViaEmail(email, otp);
      console.log(`✅ Password reset OTP resent to email: ${email}`);
    } catch (emailError) {
      console.error("❌ Failed to resend OTP email:", emailError);
      console.log(`🔧 DEVELOPMENT FALLBACK - New OTP for ${email}: ${otp}`);

      // In development, still allow the process to continue
      // In production, you might want to return an error
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          success: false,
          message: "Failed to resend OTP email. Please try again."
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "OTP resent successfully to your email",
      data: {
        email: email,
        otpExpires: otpExpires
      }
    });
  } catch (error) {
    console.error("Error resending OTP for password reset:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  sendOtpForPasswordReset,
  verifyOtpForPasswordReset,
  resetPassword,
  resendOtpForPasswordReset
};
