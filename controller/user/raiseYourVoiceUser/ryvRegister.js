const ryvUsers = require("../../../models/userModel/RaiseYourVoiceModel/raiseYourVoiceUsers");
const crypto = require("crypto");
const { sendOtpViaEmail } = require("../../../controller/user/registerUser");
const jwt = require("jsonwebtoken");

// Temporary storage for unverified Raise Your Voice users (NOT in database)
const pendingRyvRegistrations = new Map();

// Clean up expired entries every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingRyvRegistrations.entries()) {
    if (value.otpExpiry < now) {
      pendingRyvRegistrations.delete(key);
    }
  }
}, 60 * 1000); // cleanup every 1 minute

// const registerRyvUser = async (req, res) => {
//   const {
//     name,
//     phoneNo,
//     email,
//     gender,
//     aadharNo,
//     pancard,
//     state,
//     city,
//     residenceAddress,
//     dateOfBirth,
//   } = req.body;

//   try {
//     if (
//       !name ||
//       !phoneNo ||
//       !email ||
//       !gender ||
//       !aadharNo ||
//       !pancard ||
//       !state ||
//       !city ||
//       !residenceAddress ||
//       !dateOfBirth
//     ) {
//       return res.status(400).json({ message: "All fields are required." });
//     }

//     const existingVerified = await ryvUsers.findOne({
//       phoneNo,
//       isVerified: true,
//     });
//     if (existingVerified) {
//       return res
//         .status(400)
//         .json({ message: "User already exists. Please log in." });
//     }

//     await ryvUsers.deleteMany({ phoneNo, isVerified: false });

//     const mobileOtp = crypto.randomInt(100000, 999999).toString();
//     const emailOtp = crypto.randomInt(100000, 999999).toString();
//     const otpExpiry = Date.now() + 3 * 60 * 1000;

//     const newUser = new ryvUsers({
//       name,
//       phoneNo,
//       email,
//       gender,
//       aadharNo,
//       pancard,
//       state,
//       city,
//       residenceAddress,
//       whatsappOtp: mobileOtp,
//       emailOtp,
//       otpExpiry,
//       dateOfBirth,
//       isVerified: false,
//     });

//     await newUser.save();

//     await sendWhatsappOtp(phoneNo, mobileOtp, name);
//     await sendOtpViaEmail(email, emailOtp);

//     return res.status(200).json({
//       message:
//         "OTP sent to your mobile and email. Please verify within 3 minutes.",
//     });
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };



//expection handle


const registerRyvUser = async (req, res) => {
  const {
    name,
    phoneNo,
    email,
    gender,
    aadharNo,
    pancard,
    state,
    city,
    residenceAddress,
    dateOfBirth,
  } = req.body;

  try {
    // ✅ 1. Field validation
    if (
      !name ||
      !phoneNo ||
      !email ||
      !gender ||
      !aadharNo ||
      !pancard ||
      !state ||
      !city ||
      !residenceAddress ||
      !dateOfBirth
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // ✅ 2. Format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/; // Indian 10-digit
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }
    if (!mobileRegex.test(phoneNo)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number format.",
      });
    }

    // ✅ 3. Check for already verified user in Raise Your Voice panel only
    const existingVerified = await ryvUsers.findOne({
      $or: [
        { phoneNo, isVerified: true },
        { email: email.toLowerCase(), isVerified: true }
      ]
    });
    if (existingVerified) {
      return res.status(400).json({
        success: false,
        message: "User already exists in Raise Your Voice panel. Please log in.",
      });
    }

    // ✅ 4. Generate OTP
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = Date.now() + 3 * 60 * 1000;

    // ✅ 5. Store registration data temporarily (NOT in database yet)
    const registrationData = {
      name,
      phoneNo,
      email,
      gender,
      aadharNo,
      pancard,
      state,
      city,
      residenceAddress,
      dateOfBirth,
      emailOtp,
      otpExpiry
    };

    // Store in temporary memory (not database)
    const key = `${email.toLowerCase()}|${phoneNo}`;
    pendingRyvRegistrations.set(key, registrationData);

    // ✅ 7. Send OTP safely
    try {
      await sendOtpViaEmail(email, emailOtp);
    } catch (emailErr) {
      console.error("Email OTP sending failed:", emailErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send Email OTP. Please try again later.",
      });
    }

    // ✅ 8. Success response
    return res.status(200).json({
      success: true,
      message:
        "OTP sent to your email. Please verify within 3 minutes.",
    });
  } catch (error) {
    console.error("Error during RYV registration:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};


// Verify OTP Function

const verifyOtpForRyvUser = async (req, res) => {
  console.log("🔍 RYV OTP Verification Debug - Request body:", req.body);

  const { phoneNo, emailOtp, email } = req.body;

  console.log("🔍 RYV OTP Verification Debug - Extracted fields:");
  console.log("  - phoneNo:", phoneNo);
  console.log("  - emailOtp:", emailOtp);
  console.log("  - email:", email);

  if (!phoneNo || !emailOtp || !email) {
    console.log("❌ RYV OTP Verification - Missing required fields");
    return res.status(400).json({
      message: "Phone number, email, and email OTP are required.",
    });
  }

  try {
    // Find pending registration
    const key = `${email.toLowerCase()}|${phoneNo}`;
    const userData = pendingRyvRegistrations.get(key);

    if (!userData) {
      console.log("❌ RYV OTP Verification - No pending registration found");
      return res.status(404).json({
        success: false,
        message: "No registration found or OTP expired. Please register again."
      });
    }

    console.log("🔍 RYV OTP Verification Debug - Found user data:", {
      emailOtp: userData.emailOtp,
      mobileOtp: userData.mobileOtp,
      otpExpiry: userData.otpExpiry,
      currentTime: Date.now()
    });

    // Verify OTP
    const isEmailOtpValid = userData.emailOtp === emailOtp?.toString().trim();
    const isOtpExpired = Date.now() > userData.otpExpiry;

    console.log("🔍 RYV OTP Verification Debug - Validation results:");
    console.log("  - isEmailOtpValid:", isEmailOtpValid);
    console.log("  - isOtpExpired:", isOtpExpired);

    if (!isEmailOtpValid || isOtpExpired) {
      console.log("❌ RYV OTP Verification - Invalid or expired OTP");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please try again."
      });
    }

    // Create new user in database (only after successful OTP verification)
    const newUser = new ryvUsers({
      name: userData.name,
      phoneNo: userData.phoneNo,
      email: userData.email,
      gender: userData.gender,
      aadharNo: userData.aadharNo,
      pancard: userData.pancard,
      state: userData.state,
      city: userData.city,
      residenceAddress: userData.residenceAddress,
      dateOfBirth: userData.dateOfBirth,
      isVerified: true,
    });

    await newUser.save();

    // Clean up pending registration
    pendingRyvRegistrations.delete(key);

    console.log("✅ RYV OTP Verification - User created successfully");

    const token = jwt.sign(
      { userId: newUser._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. Registration completed.",
      token,
      data: {
        userId: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phoneNo: newUser.phoneNo,
        isVerified: newUser.isVerified
      }
    });

  } catch (error) {
    console.error("💥 RYV OTP Verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};

module.exports = { registerRyvUser, verifyOtpForRyvUser };
