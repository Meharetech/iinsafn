const bcrypt = require("bcrypt");
const crypto = require("crypto");
const AdvocateUser = require("../../models/advocateUser/advocateUser");
const Wallet = require("../../models/Wallet/walletSchema");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
require("dotenv").config();
const { sendEmail } = require("../../utils/emailTemplates");

// Configure multer for profile image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./upload/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `advocate-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/bmp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and BMP images are allowed"), false);
    }
  },
}).single("profileImage");

// Temporary storage for unverified advocate users
const pendingAdvocateRegistrations = new Map();

// Clean up expired entries every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingAdvocateRegistrations.entries()) {
    if (value.otpExpiry < now) {
      pendingAdvocateRegistrations.delete(key);
    }
  }
}, 60 * 1000);

const generateUniqueAdvocateId = async () => {
  let uniqueId;
  let exists = true;
  let counter = 0;

  while (exists) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    uniqueId = `ADV${randomNum}`;
    console.log(`🔍 Trying advocateId: ${uniqueId}`);

    const existingUser = await AdvocateUser.findOne({ advocateId: uniqueId });

    if (!existingUser) {
      exists = false;
      console.log(`✅ Unique advocateId found: ${uniqueId}`);
    } else {
      console.log(`⚠️ advocateId already exists: ${uniqueId}`);
    }

    counter++;
    if (counter > 20) {
      throw new Error("🚨 Too many attempts to generate unique advocateId");
    }
  }

  return uniqueId;
};

const sendOtpViaSMS = async (mobile, otp, userName) => {
  try {
    const apiKey = process.env.AISENSY_API_KEY;
    
    if (!apiKey) {
      throw new Error("AISENSY_API_KEY is not configured");
    }
    
    if (!mobile || !otp) {
      throw new Error("Mobile number and OTP are required");
    }

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
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #ff6b35; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #ff6b35; letter-spacing: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Advocate Registration - OTP Verification</h1>
        </div>
        <div class="content">
          <p>Hello ${userName || "User"},</p>
          <p>Thank you for registering as an Advocate. Please use the OTP below to complete your registration:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p>This OTP is valid for 3 minutes. Please do not share this OTP with anyone.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>Best Regards,<br>IINSAF Advocate Portal Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail(
    email,
    "Advocate Registration - OTP Verification",
    `Your OTP code for Advocate registration is ${otp}. It is valid for 3 minutes.`,
    emailHtml
  );
};

const verifyOtp = async (req, res) => {
  try {
    const { email, phoneNo, emailOtp, whatsappotp } = req.body;
    
    // Validate required fields
    if (!email || !phoneNo || !emailOtp || !whatsappotp) {
      return res.status(400).json({
        success: false,
        message: "Email, phone number, and both OTPs are required",
      });
    }

    // Normalize email to lowercase for consistent key matching
    const emailLower = email.toLowerCase().trim();
    const key = `${emailLower}|${phoneNo}`;

    console.log("🔍 Looking for registration with key:", key);
    const userData = pendingAdvocateRegistrations.get(key);

    if (!userData) {
      console.log("❌ No advocate registration found or OTP expired.");
      return res.status(400).json({
        success: false,
        message: "No registration found or OTP expired. Please register again.",
      });
    }

    const { emailOtp: storedEmailOtp, mobileOtp: storedMobileOtp, otpExpiry } = userData;
    const isEmailOtpValid = storedEmailOtp === emailOtp?.toString().trim();
    const isMobileOtpValid = storedMobileOtp === whatsappotp?.toString().trim();
    const isOtpExpired = Date.now() > otpExpiry;

    console.log("🔐 OTP Validation:", {
      emailOtpMatch: isEmailOtpValid,
      mobileOtpMatch: isMobileOtpValid,
      isExpired: isOtpExpired,
      storedEmailOtp: storedEmailOtp,
      receivedEmailOtp: emailOtp?.toString().trim(),
      storedMobileOtp: storedMobileOtp,
      receivedMobileOtp: whatsappotp?.toString().trim(),
    });

    if (!isEmailOtpValid || !isMobileOtpValid || isOtpExpired) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired OTP" 
      });
    }

    const advocateId = await generateUniqueAdvocateId();

    const user = new AdvocateUser({
      name: userData.name,
      phoneNo: userData.phoneNo,
      email: userData.email,
      dateOfBirth: userData.dateOfBirth,
      gender: userData.gender,
      aadharNo: userData.aadharNo,
      pancard: userData.pancard,
      residenceAddress: userData.residenceAddress,
      state: userData.state,
      city: userData.city,
      pincode: userData.pincode,
      password: userData.password,
      profileImage: userData.profileImage,
      specialization: userData.specialization,
      experience: userData.experience,
      barAssociationCourt: userData.barAssociationCourt,
      uniqueId: userData.uniqueId,
      isVerified: true,
      advocateId,
    });

    await user.save();
    console.log("✅ Advocate user saved:", user._id);
    
    // Create wallet for the new advocate user with default balance 0
    try {
      const wallet = new Wallet({
        userId: user._id,
        userType: "AdvocateUser",
        balance: 0,
        transactions: []
      });
      
      await wallet.save();
      console.log(`✅ Wallet created for advocate user: ${user._id} with balance: ₹0`);
    } catch (walletErr) {
      console.error("⚠️ Wallet creation error (continuing anyway):", walletErr);
      // Continue even if wallet creation fails
    }
    
    pendingAdvocateRegistrations.delete(key);

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const payload = {
      id: user._id,
      role: "advocate",
      userType: "advocate",
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      success: true,
      message: "Advocate registration successful! You can now login.",
      token,
      advocateId,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: "advocate",
        advocateId: user.advocateId,
      },
    });
  } catch (err) {
    console.error("💥 Advocate OTP verification error:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const preRegisterUser = async (req, res) => {
  console.log("Advocate registration request received");
  
  // Handle file upload first
  upload(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        success: false,
        message: uploadErr.message || "File upload error",
      });
    }

    const {
      name,
      gender,
      email,
      phoneNo,
      password,
      aadharNo,
      dateOfBirth,
      pancard,
      residenceAddress,
      state,
      city,
      pincode,
      specialization,
      experience,
      barAssociationCourt,
      uniqueId,
    } = req.body;

    try {
      console.log("Starting Advocate registration validation...");
      
      // ✅ Basic validations
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const mobileRegex = /^[6-9]\d{9}$/;

      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }

      // Check if email is @gmail.com only
      if (!email.toLowerCase().endsWith('@gmail.com')) {
        return res.status(400).json({
          success: false,
          message: "Only @gmail.com email addresses are allowed",
        });
      }

      if (!mobileRegex.test(phoneNo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid mobile number",
        });
      }

      // ✅ Check if user already exists
      console.log("Checking for existing Advocate user...");
      const existingUser = await AdvocateUser.findOne({ 
        $or: [
          { email: email.toLowerCase() }, 
          { phoneNo } 
        ] 
      });
      
      if (existingUser) {
        console.log("Existing user found:", existingUser.email);
        return res.status(400).json({
          success: false,
          message: existingUser.isVerified
            ? "Advocate user already exists. Please login."
            : "Advocate user already registered but not verified. Please verify your account.",
        });
      }
      console.log("No existing user found, proceeding with registration...");

      // ✅ Handle profile image upload to Cloudinary
      let profileImageUrl = null;
      if (req.file) {
        try {
          const cloudinaryResult = await uploadToCloudinary(req.file.path, "advocate-profiles");
          if (cloudinaryResult && cloudinaryResult.secure_url) {
            profileImageUrl = cloudinaryResult.secure_url;
            console.log("Profile image uploaded to Cloudinary:", profileImageUrl);
          } else {
            throw new Error("Cloudinary upload returned no URL");
          }
        } catch (cloudinaryErr) {
          console.error("Cloudinary upload error:", cloudinaryErr);
          return res.status(500).json({
            success: false,
            message: "Failed to upload profile image. Please try again.",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Profile image is required",
        });
      }

      // ✅ Generate OTPs
      const mobileOtp = crypto.randomInt(100000, 999999).toString();
      const emailOtp = crypto.randomInt(100000, 999999).toString();
      const otpExpiry = Date.now() + 3 * 60 * 1000; // 3 minutes

      const hashedPassword = await bcrypt.hash(password, 10);

      // ✅ Store pending registration (use lowercase email for consistent key matching)
      const emailLower = email.toLowerCase().trim();
      pendingAdvocateRegistrations.set(`${emailLower}|${phoneNo}`, {
        name,
        gender,
        email: email.toLowerCase(),
        phoneNo,
        password: hashedPassword,
        aadharNo,
        dateOfBirth,
        pancard,
        residenceAddress,
        state,
        city,
        pincode,
        profileImage: profileImageUrl,
        specialization,
        experience: parseInt(experience),
        barAssociationCourt,
        uniqueId,
        mobileOtp,
        emailOtp,
        otpExpiry,
      });

      // ✅ Send OTPs
      console.log("Sending OTPs...");
      try {
        await sendOtpViaEmail(email, emailOtp, name);
        console.log("Email OTP sent successfully");
        await sendOtpViaSMS(phoneNo, mobileOtp, name);
        console.log("WhatsApp OTP sent successfully");
      } catch (otpError) {
        console.error("OTP sending error:", otpError);
        // Continue with registration even if OTP sending fails
      }

      return res.status(200).json({
        success: true,
        message: "OTP sent to your mobile and email. Please verify within 3 minutes.",
      });
    } catch (err) {
      console.error("Advocate pre-registration error:", err);
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
  });
};

const resendOtp = async (req, res) => {
  const { email, phoneNo } = req.body;
  
  // Normalize email to lowercase for consistent key matching
  const emailLower = email ? email.toLowerCase().trim() : '';
  const key = `${emailLower}|${phoneNo}`;

  const userData = pendingAdvocateRegistrations.get(key);

  if (!userData) {
    return res.status(400).json({
      success: false,
      message: "No pending Advocate registration found. Please register again.",
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
    pendingAdvocateRegistrations.set(key, userData);

    // Send OTPs again
    await sendOtpViaEmail(email, newEmailOtp, userData.name);
    await sendOtpViaSMS(phoneNo, newMobileOtp, userData.name);

    return res.status(200).json({
      success: true,
      message: "New OTPs sent successfully for Advocate registration.",
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

