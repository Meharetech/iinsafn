const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");
const Wallet = require("../../models/Wallet/walletSchema");
const axios = require("axios");
require("dotenv").config();
const { sendEmail, getPressConferenceTemplate } = require("../../utils/emailTemplates");

// Test model import
console.log("PressConferenceUser model loaded:", PressConferenceUser ? "Success" : "Failed");

// Temporary storage for unverified press conference users
const pendingPressRegistrations = new Map();

// Clean up expired entries every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingPressRegistrations.entries()) {
    if (value.otpExpiry < now) {
      pendingPressRegistrations.delete(key);
    }
  }
}, 60 * 1000); // cleanup every 1 minute

const generateUniquePressConferenceId = async () => {
  let uniqueId;
  let exists = true;
  let counter = 0;

  while (exists) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    uniqueId = `PRESS${randomNum}`;
    console.log(`🔍 Trying pressConferenceId: ${uniqueId}`);

    const existingUser = await PressConferenceUser.findOne({ pressConferenceId: uniqueId });

    if (!existingUser) {
      exists = false;
      console.log(`✅ Unique pressConferenceId found: ${uniqueId}`);
    } else {
      console.log(`⚠️ pressConferenceId already exists: ${uniqueId}`);
    }

    counter++;
    if (counter > 20) {
      throw new Error("🚨 Too many attempts to generate unique pressConferenceId");
    }
  }

  return uniqueId;
};

const sendOtpViaSMS = async (mobile, otp, userName) => {
  try {
    const apiKey = process.env.AISENSY_API_KEY;
    
    // Validate required parameters
    if (!apiKey) {
      throw new Error("AISENSY_API_KEY is not configured");
    }
    
    if (!mobile || !otp) {
      throw new Error("Mobile number and OTP are required");
    }

    // Clean and validate userName
    let cleanUserName = userName ? userName.trim() : "User";
    if (!cleanUserName || cleanUserName.length === 0 || cleanUserName.trim().length === 0) {
      console.warn("Invalid userName format, using fallback:", userName);
      cleanUserName = "User";
    }

    const requestData = {
      apiKey,
      campaignName: "copy_otp",
      destination: `91${mobile}`,
      userName: cleanUserName,
      templateParams: [`${otp}`],
      buttons: [
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: `${otp}`,
            },
          ],
        },
      ],
    };

    console.log("Sending WhatsApp OTP request:", {
      destination: requestData.destination,
      userName: cleanUserName,
      campaignName: requestData.campaignName
    });

    const response = await axios.post(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      requestData
    );

    console.log("WhatsApp OTP response:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending WhatsApp OTP:",
      error?.response?.data || error.message
    );
    throw new Error("Failed to send WhatsApp OTP");
  }
};

const sendOtpViaEmail = async (email, otp, userName) => {
  const emailHtml = getPressConferenceTemplate(userName || "User", otp, "complete your registration");
  
  await sendEmail(
    email,
    "Press Conference Registration - OTP Verification",
    `Your OTP code for Press Conference registration is ${otp}. It is valid for 10 minutes.`,
    emailHtml
  );
};

const verifyOtp = async (req, res) => {
  const { email, mobile, otpEmail, otpMobile } = req.body;
  const key = `${email}|${mobile}`;

  const userData = pendingPressRegistrations.get(key);

  if (!userData) {
    console.log("❌ No press conference registration found or OTP expired.");
    return res.status(400).json({
      success: false,
      message: "No registration found or OTP expired. Please register again.",
    });
  }

  const { emailOtp, mobileOtp, otpExpiry } = userData;
  const isEmailOtpValid = emailOtp === otpEmail?.toString().trim();
  const isMobileOtpValid = mobileOtp === otpMobile?.toString().trim();
  const isOtpExpired = Date.now() > otpExpiry;

  if (!isEmailOtpValid || !isMobileOtpValid || isOtpExpired) {
    return res.status(400).json({ 
      success: false,
      message: "Invalid or expired OTP" 
    });
  }

  try {
    const pressConferenceId = await generateUniquePressConferenceId();

    const user = new PressConferenceUser({
      ...userData,
      isVerified: true,
      pressConferenceId,
    });

    await user.save();
    
    // Create wallet for the new press user with default balance 0
    const wallet = new Wallet({
      userId: user._id,
      userType: "PressConferenceUser",
      balance: 0,
      transactions: []
    });
    
    await wallet.save();
    console.log(`✅ Wallet created for press user: ${user._id} with balance: ₹0`);
    
    pendingPressRegistrations.delete(key);

    return res.status(200).json({
      success: true,
      message: "Press Conference registration successful! You can now login.",
      pressConferenceId,
    });
  } catch (err) {
    console.error("💥 Press Conference OTP verification error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const preRegisterUser = async (req, res) => {
  console.log("Press Conference registration request received:", req.body);
  
  const {
    name,
    residenceaddress,
    mobile,
    email,
    state,
    city,
    gender,
    pincode,
    password,
    aadharNo,
    pancard,
    dateOfBirth,
    bloodType,
    organization,
    designation,
    mediaType,
  } = req.body;

  try {
    console.log("Starting Press Conference registration validation...");
    // ✅ Basic validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/; // Indian 10-digit numbers starting 6–9

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number",
      });
    }

    // ✅ Check if user already exists in Press Conference panel only
    console.log("Checking for existing Press Conference user...");
    const existingUser = await PressConferenceUser.findOne({ 
      $or: [
        { email: email.toLowerCase() }, 
        { mobile } 
      ] 
    });
    if (existingUser) {
      console.log("Existing user found:", existingUser.email);
      return res.status(400).json({
        success: false,
        message: existingUser.isVerified
          ? "Press Conference user already exists in this panel"
          : "Press Conference user already registered but not verified in this panel",
      });
    }
    console.log("No existing user found, proceeding with registration...");

    // ✅ Generate OTPs
    const mobileOtp = crypto.randomInt(100000, 999999).toString();
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = Date.now() + 3 * 60 * 1000; // 3 minutes

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Store pending registration
    pendingPressRegistrations.set(`${email}|${mobile}`, {
      name,
      residenceaddress,
      mobile,
      email,
      state,
      city,
      gender,
      pincode,
      password: hashedPassword,
      aadharNo,
      pancard,
      dateOfBirth,
      bloodType,
      organization,
      designation,
      mediaType,
      mobileOtp,
      emailOtp,
      otpExpiry,
    });

    // ✅ Send OTPs
    console.log("Sending OTPs...");
    try {
      await sendOtpViaEmail(email, emailOtp, name);
      console.log("Email OTP sent successfully");
      await sendOtpViaSMS(mobile, mobileOtp, name);
      console.log("WhatsApp OTP sent successfully");
    } catch (otpError) {
      console.error("OTP sending error:", otpError);
      // Continue with registration even if OTP sending fails
    }

    return res.status(200).json({
      success: true,
      message: "OTPs sent to email and mobile. Please verify to complete Press Conference registration.",
    });
  } catch (err) {
    console.error("Press Conference pre-registration error:", err);
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const resendOtp = async (req, res) => {
  const { email, mobile } = req.body;
  const key = `${email}|${mobile}`;

  const userData = pendingPressRegistrations.get(key);

  if (!userData) {
    return res.status(400).json({
      success: false,
      message: "No pending Press Conference registration found. Please register again.",
    });
  }

  try {
    // Generate new OTPs
    const newMobileOtp = crypto.randomInt(100000, 999999).toString();
    const newEmailOtp = crypto.randomInt(100000, 999999).toString();
    const newOtpExpiry = Date.now() + 3 * 60 * 1000; // reset to 3 minutes

    // Update stored OTPs
    userData.mobileOtp = newMobileOtp;
    userData.emailOtp = newEmailOtp;
    userData.otpExpiry = newOtpExpiry;
    pendingPressRegistrations.set(key, userData);

    // Send OTPs again
    await sendOtpViaEmail(email, newEmailOtp, userData.name);
    await sendOtpViaSMS(mobile, newMobileOtp, userData.name);

    return res.status(200).json({
      success: true,
      message: "New OTPs sent successfully for Press Conference registration.",
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP. Please try again later.",
    });
  }
};

module.exports = { 
  preRegisterUser, 
  verifyOtp, 
  sendOtpViaSMS, 
  sendOtpViaEmail, 
  resendOtp 
};
