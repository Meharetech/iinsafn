const bcrypt = require("bcrypt");
const User = require("../../models/userModel/userModel");

/**
 * Check if reporter credentials are correct
 * POST /login/check
 * Body: { email: string, password: string }
 * Returns: { success: true/false }
 */
const checkReporterLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.trim() });

    // If user not found, return false
    if (!user) {
      return res.json({
        success: true,
        result: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is a Reporter
    if (user.role !== "Reporter") {
      return res.json({
        success: true,
        result: false,
        message: "User is not a reporter",
      });
    }

    // Check if account is verified
    if (!user.isVerified) {
      return res.json({
        success: true,
        result: false,
        message: "Account not verified",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      return res.json({
        success: true,
        result: true,
        message: "Credentials are correct",
      });
    } else {
      return res.json({
        success: true,
        result: false,
        message: "Invalid credentials",
      });
    }
  } catch (err) {
    console.error("Check login error:", err.message);
    return res.status(500).json({
      success: false,
      result: false,
      message: "Server error. Please try again later.",
    });
  }
};

module.exports = checkReporterLogin;










