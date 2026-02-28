const bcrypt = require("bcrypt");
// const crypto = require("crypto");
const nodemailer = require("nodemailer");
const axios = require("axios");
const User = require("../../models/userModel/userModel");
const jwt = require("jsonwebtoken");


const loginUser = async (req, res) => {
  const { emailOrMobile, password } = req.body;

  try {
    if (!emailOrMobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/Mobile and password are required",
      });
    }

    const identifier = String(emailOrMobile).trim();
    let user;

    // ✅ Regex for validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/;

    if (emailRegex.test(identifier)) {
      // Email login
      user = await User.findOne({ email: identifier });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No user found for this email",
        });
      }
    } else if (mobileRegex.test(identifier)) {
      // Mobile login
      user = await User.findOne({ mobile: Number(identifier) });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No user found for this mobile number",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: emailOrMobile.includes("@")
          ? "Wrong email format"
          : "Wrong mobile number format",
      });
    }

    // ✅ Check verification
    if (!user.isVerified) {
      return res.status(400).json({
        success: false,
        message:
          "Account not verified. Please verify your account before logging in.",
      });
    }

    // ✅ Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Wrong password",
      });
    }

    // ✅ Send notifications (safe try/catch)
    try {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        secure: true,
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Login Notification",
        text: `Hello ${user.name},\n\nYou have successfully logged into your account.\n\nBest Regards,\nIinsaf`,
      };

      transporter.sendMail(mailOptions).catch((err) => {
        console.error("Email notification failed:", err.message);
      });
    } catch (notifyErr) {
      console.error("Notification error:", notifyErr.message);
    }

    // ✅ Return JWT token with role
    const payload = {
      userId: { id: user._id },
      role: user.role,
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
      (err, token) => {
        if (err) {
          console.error("JWT signing error:", err.message);
          return res.status(500).json({
            success: false,
            message: "Authentication failed. Please try again.",
          });
        }

        res.json({
          success: true,
          token,
          role: user.role,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      }
    );
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};


module.exports = loginUser;
