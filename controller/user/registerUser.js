const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../../models/userModel/userModel");
const axios = require("axios");
require("dotenv").config();
const wallet = require("../../models/Wallet/walletSchema");
const { sendEmail, getOtpTemplate } = require("../../utils/emailTemplates");

// Temporary storage for unverified users
const pendingRegistrations = new Map();

// Clean up expired entries every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingRegistrations.entries()) {
    if (value.otpExpiry < now) {
      pendingRegistrations.delete(key);
    }
  }
}, 60 * 1000); // cleanup every 1 minute


const generateUniqueIinsafId = async (role) => {
  const prefix = role === "Advertiser" ? "ADVERTISER" : "INFLUENCER";
  let uniqueId;
  let exists = true;
  let counter = 0;

  while (exists) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    uniqueId = `${prefix}${randomNum}`;
    console.log(`🔍 Trying iinsafId: ${uniqueId}`);

    const existingUser = await User.findOne({ iinsafId: uniqueId });

    if (!existingUser) {
      exists = false;
      console.log(`✅ Unique iinsafId found: ${uniqueId}`);
    } else {
      console.log(`⚠️ iinsafId already exists: ${uniqueId}`);
    }

    counter++;
    if (counter > 20) {
      throw new Error("🚨 Too many attempts to generate unique iinsafId");
    }
  }

  return uniqueId;
};




const sendOtpViaSMS = async (mobile, otp, userName) => {
  try {
    const apiKey = process.env.AISENSY_API_KEY;

    // Validate required parameters
    if (!apiKey) {
      throw new Error("AiSensy API key not configured");
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

    const requestPayload = {
      apiKey,
      campaignName: "copy_otp",
      destination: `91${mobile}`,
      userName: cleanUserName,
      templateParams: [`${otp}`], // Only send OTP as template parameter
      paramsFallbackValue: { FirstName: cleanUserName },
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

    console.log("📤 Sending WhatsApp OTP request:", {
      ...requestPayload,
      apiKey: apiKey ? "***configured***" : "NOT_SET"
    });

    const response = await axios.post(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      requestPayload
    );

    console.log(`✅ WhatsApp OTP sent successfully to ${mobile} for user ${cleanUserName}`);
    return response.data;
  } catch (error) {
    console.error("=== WhatsApp OTP Error Details ===");
    console.error("Mobile:", mobile);
    console.error("OTP:", otp);
    console.error("UserName:", cleanUserName);
    console.error("API Response:", error?.response?.data);
    console.error("Error Message:", error.message);
    console.error("Error Status:", error?.response?.status);
    console.error("================================");

    throw new Error("Failed to send WhatsApp OTP");
  }
};


const sendOtpViaEmail = async (email, otp, userName) => {
  const emailHtml = getOtpTemplate(userName || "User", otp, "verify your email address for registration", 10);

  await sendEmail(
    email,
    "Email Verification OTP - iinsaf Platform",
    `Your OTP code is ${otp}. It is valid for 10 minutes.`,
    emailHtml
  );
};




const verifyOtp = async (req, res) => {
  console.log("🔍 OTP Verification Debug - Request body:", req.body);

  const { email, mobile, otpEmail, otpMobile } = req.body;
  // Normalize identifiers to avoid key mismatches due to casing/whitespace
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;
  const normalizedMobile = typeof mobile === 'string' ? mobile.trim() : mobile;
  const key = `${normalizedEmail}|${normalizedMobile}`;

  console.log("🔍 OTP Verification Debug - Key:", key);
  console.log("🔍 OTP Verification Debug - Pending registrations keys:", Array.from(pendingRegistrations.keys()));

  const userData = pendingRegistrations.get(key);

  if (!userData) {
    console.log("❌ No registration found or OTP expired.");
    console.log("🔍 Available keys in pendingRegistrations:", Array.from(pendingRegistrations.keys()));
    return res.status(400).json({
      msg: "No registration found or OTP expired. Please register again.",
    });
  }

  const { emailOtp, mobileOtp, otpExpiry } = userData;

  console.log("🔍 OTP Verification Debug - Stored OTPs:");
  console.log("  - emailOtp:", emailOtp, "Type:", typeof emailOtp);
  console.log("  - mobileOtp:", mobileOtp, "Type:", typeof mobileOtp);
  console.log("  - otpExpiry:", otpExpiry, "Current time:", Date.now());

  console.log("🔍 OTP Verification Debug - Received OTPs:");
  console.log("  - otpEmail:", otpEmail, "Type:", typeof otpEmail);
  console.log("  - otpMobile:", otpMobile, "Type:", typeof otpMobile);

  // We are requiring the entered OTP to match EITHER the sent Email OTP or the Mobile OTP
  // since the sender might use one box for both.
  const enteredOtp = otpEmail?.toString().trim();
  const isEmailOtpValid = emailOtp === enteredOtp;
  const isMobileOtpValid = mobileOtp === enteredOtp;

  const isOtpValid = isEmailOtpValid || isMobileOtpValid;
  const isOtpExpired = Date.now() > otpExpiry;

  console.log("🔍 OTP Verification Debug - Validation results:");
  console.log("  - Entered OTP:", enteredOtp);
  console.log("  - matches email OTP?:", isEmailOtpValid);
  console.log("  - matches mobile OTP?:", isMobileOtpValid);
  console.log("  - isOtpExpired:", isOtpExpired);

  if (!isOtpValid || isOtpExpired) {
    console.log("❌ OTP validation failed");
    return res.status(400).json({ msg: "Invalid or expired OTP" });
  }

  try {
    let userData_toSave = {
      ...userData,
      isVerified: true,
    };

    // Only add iinsafId for Advertiser role
    if (userData.role === "Advertiser") {
      const iinsafId = await generateUniqueIinsafId(userData.role);
      userData_toSave.iinsafId = iinsafId;
      console.log("✅ Generated iinsafId for Advertiser:", iinsafId);
    } else if (userData.role === "Influencer" || userData.role === "Reporter") {
      // Don't include iinsafId field at all - will be assigned after verification
      console.log(`✅ Creating ${userData.role} without iinsafId - will be assigned after verification`);
    }

    const user = new User(userData_toSave);

    await user.save();
    console.log("✅ User saved successfully:", userData.role);

    // Create wallet for the user
    try {
      const newWallet = await wallet.create({
        userId: user._id,
        userType: user.role,
        balance: 0,
        transactions: [],
      });
      console.log("✅ Wallet created successfully for user:", user.role);
    } catch (walletError) {
      console.error("❌ Wallet creation error:", walletError);
      // Don't fail the registration if wallet creation fails
    }

    pendingRegistrations.delete(key);
    console.log("✅ Registration completed successfully for:", user.role);

    return res.status(200).json({
      success: true,
      msg: "OTP verified successfully. You are now registered.",
      iinsafId: userData_toSave.iinsafId || null,
      message: userData.role === "Advertiser"
        ? "Your Advertiser ID has been generated."
        : "Your ID will be assigned after verification.",
    });
  } catch (err) {
    console.error("💥 OTP verification error:", err);
    return res.status(500).send("Server error");
  }
};


//exeption handling
const preRegisterUser = async (req, res) => {
  const {
    name,
    residenceaddress,
    mobile,
    email,
    state,
    city,
    gender,
    role,
    pincode,
    password,
    aadharNo,
    pancard,
    dateOfBirth,
    bloodType,
  } = req.body;


  try {
    // ✅ Basic validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/; // Indian 10-digit numbers starting 6–9

    // Validate name field
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be a valid string",
      });
    }

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

    // ✅ Check if user already exists in main User model
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.isVerified
          ? "User already exists in main registration panel"
          : "User already registered but not verified in main panel",
      });
    }

    // ✅ Generate OTPs
    const mobileOtp = crypto.randomInt(100000, 999999).toString();
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Store pending registration
    const registrationData = {
      name: name.trim(), // Ensure name is trimmed
      residenceaddress,
      mobile,
      email,
      state,
      city,
      gender,
      role,
      pincode,
      password: hashedPassword,
      aadharNo,
      pancard,
      dateOfBirth,
      bloodType,
      mobileOtp,
      emailOtp,
      otpExpiry,
    };

    // Normalize identifiers for consistent keying
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;
    const normalizedMobile = typeof mobile === 'string' ? mobile.trim() : mobile;
    const key = `${normalizedEmail}|${normalizedMobile}`;
    pendingRegistrations.set(key, registrationData);

    console.log("🔍 Pre-registration Debug - Stored data:");
    console.log("  - Key:", key);
    console.log("  - mobileOtp:", mobileOtp, "Type:", typeof mobileOtp);
    console.log("  - emailOtp:", emailOtp, "Type:", typeof emailOtp);
    console.log("  - otpExpiry:", otpExpiry);
    console.log("  - role:", role);

    // ✅ Send OTPs
    await sendOtpViaEmail(email, emailOtp, name.trim());
    try {
      await sendOtpViaSMS(mobile, mobileOtp, name.trim());
    } catch (e) {
      console.log("Ignoring WhatsApp failure. Proceeding with Email OTP.");
    }

    return res.status(200).json({
      success: true,
      message:
        "OTPs sent to email and mobile. Please verify to complete registration.",
    });
  } catch (err) {
    console.error("Pre-registration error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};






const resendOtp = async (req, res) => {
  const { email, mobile } = req.body;
  // Normalize identifiers for consistent keying
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;
  const normalizedMobile = typeof mobile === 'string' ? mobile.trim() : mobile;
  const key = `${normalizedEmail}|${normalizedMobile}`;

  const userData = pendingRegistrations.get(key);

  if (!userData) {
    return res.status(400).json({
      success: false,
      message: "No pending registration found. Please register again.",
    });
  }

  try {
    // Generate new OTPs
    const newMobileOtp = crypto.randomInt(100000, 999999).toString();
    const newEmailOtp = crypto.randomInt(100000, 999999).toString();
    const newOtpExpiry = Date.now() + 10 * 60 * 1000; // reset to 10 minutes

    // Update stored OTPs
    userData.mobileOtp = newMobileOtp;
    userData.emailOtp = newEmailOtp;
    userData.otpExpiry = newOtpExpiry;
    pendingRegistrations.set(key, userData);

    // Send OTPs again
    await sendOtpViaEmail(email, newEmailOtp, userData.name);
    try {
      await sendOtpViaSMS(mobile, newMobileOtp, userData.name);
    } catch (e) {
      console.log("Ignoring WhatsApp failure on resend.");
    }

    return res.status(200).json({
      success: true,
      message: "New OTPs sent successfully.",
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP. Please try again later.",
    });
  }
};


// Test function for OTP sending
const testOtpSending = async (req, res) => {
  try {
    const { mobile, userName } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required for testing"
      });
    }

    // Generate a test OTP
    const testOtp = "123456";

    console.log(`🧪 Testing OTP sending to ${mobile} for user ${userName || "Test User"}`);

    // Test the OTP sending
    await sendOtpViaSMS(mobile, testOtp, userName || "Test User");

    res.status(200).json({
      success: true,
      message: "Test OTP sent successfully",
      testOtp: testOtp,
      mobile: mobile,
      userName: userName || "Test User"
    });

  } catch (error) {
    console.error("Test OTP sending error:", error);
    res.status(500).json({
      success: false,
      message: "Test OTP sending failed",
      error: error.message
    });
  }
};

// Test endpoint to check pending registrations
const testPendingRegistrations = async (req, res) => {
  try {
    const allKeys = Array.from(pendingRegistrations.keys());
    const allData = {};

    for (const key of allKeys) {
      const data = pendingRegistrations.get(key);
      allData[key] = {
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        role: data.role,
        emailOtp: data.emailOtp,
        mobileOtp: data.mobileOtp,
        otpExpiry: data.otpExpiry,
        isExpired: Date.now() > data.otpExpiry
      };
    }

    return res.status(200).json({
      success: true,
      message: "Pending registrations retrieved",
      count: allKeys.length,
      data: allData
    });
  } catch (error) {
    console.error("Test pending registrations error:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving pending registrations",
      error: error.message
    });
  }
};

module.exports = { preRegisterUser, verifyOtp, sendOtpViaSMS, sendOtpViaEmail, resendOtp, testOtpSending, testPendingRegistrations };
