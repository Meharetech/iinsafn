const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");
const jwt = require("jsonwebtoken");
const axios = require("axios");

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
      user = await PressConferenceUser.findOne({ email: identifier });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No Press Conference user found for this email",
        });
      }
    } else if (mobileRegex.test(identifier)) {
      // Mobile login
      user = await PressConferenceUser.findOne({ mobile: Number(identifier) });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No Press Conference user found for this mobile number",
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
        message: "Press Conference account not verified. Please verify your account before logging in.",
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
        subject: "Press Conference Login Notification",
        text: `Hello ${user.name},\n\nYou have successfully logged into your Press Conference account.\n\nBest Regards,\nIINSAF Press Conference Team`,
      };

      transporter.sendMail(mailOptions).catch((err) => {
        console.error("Email notification failed:", err.message);
      });

      sendOtpViaWATemplate(user.mobile, user.name, "press_login_msg").catch((err) => {
        console.error("WhatsApp notification failed:", err.message);
      });
    } catch (notifyErr) {
      console.error("Notification error:", notifyErr.message);
    }

    // ✅ Return JWT token with role
    const payload = {
      id: user._id,
      role: "Press Conference",
      userType: "pressConference",
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
          role: "Press Conference",
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: "Press Conference",
            pressConferenceId: user.pressConferenceId,
            organization: user.organization,
            designation: user.designation,
            mediaType: user.mediaType,
          },
        });
      }
    );
  } catch (err) {
    console.error("Press Conference login error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const sendOtpViaWATemplate = async (mobile, userName, campaignName) => {
  try {
    const apiKey = process.env.AISENSY_API_KEY;

    const response = await axios.post("https://backend.aisensy.com/campaign/t1/api/v2", {
      apiKey,
      campaignName,
      destination: `91${mobile}`,
      userName,
      templateParams: [userName], // must match your template setup in AiSensy
      paramsFallbackValue: { FirstName: userName },
    });

    return response.data;

  } catch (error) {
    console.error("Error sending WhatsApp press conference login notification:", error?.response?.data || error.message);
    throw new Error("Failed to send WhatsApp notification");
  }
};

module.exports = loginUser;
