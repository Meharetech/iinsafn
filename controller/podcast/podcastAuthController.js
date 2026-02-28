const PodcastUser = require("../../models/podcastUser/podcastUserSchema");
const PodcastOtpStore = require("../../models/podcastUser/podcastOtpStore");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sendEmail = require("../../utils/sendEmail");
const { getPodcastTemplate } = require("../../utils/emailTemplates");

// Temporary storage for unverified podcast users (NOT in database)
const pendingPodcastRegistrations = new Map();

// Clean up expired entries every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingPodcastRegistrations.entries()) {
    if (value.otpExpiry < now) {
      pendingPodcastRegistrations.delete(key);
    }
  }
}, 60 * 1000); // cleanup every 1 minute

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Register new podcast user
const registerPodcastUser = async (req, res) => {
  try {
    const {
      name,
      gender,
      email,
      phoneNo,
      aadharNo,
      dateOfBirth,
      pancard,
      residenceAddress,
      state,
      city,
      pincode,
      termsAccepted
    } = req.body;

    // Check if terms are accepted
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: "You must accept the terms and conditions"
      });
    }

    // Check if user already exists in Podcast panel only (verified users)
    const existingUser = await PodcastUser.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phoneNo },
        { aadharNo },
        { pancard: pancard.toUpperCase() }
      ],
      isVerified: true
    });

    if (existingUser) {
      let field = "";
      if (existingUser.email === email.toLowerCase()) field = "email";
      else if (existingUser.phoneNo === phoneNo) field = "phone number";
      else if (existingUser.aadharNo === aadharNo) field = "Aadhar number";
      else if (existingUser.pancard === pancard.toUpperCase()) field = "PAN card";

      return res.status(400).json({
        success: false,
        message: `User already exists in Podcast panel with this ${field}. Please log in to Podcast panel.`
      });
    }

    // Check if there's already a pending registration
    const key = `${email.toLowerCase()}|${phoneNo}`;
    const existingPending = pendingPodcastRegistrations.get(key);
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "Registration already in progress. Please check your email and phone for OTP."
      });
    }

    // Generate OTP
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 3 * 60 * 1000; // 3 minutes

    // Store registration data temporarily (NOT in database yet)
    const registrationData = {
      name: name.trim(),
      gender,
      email: email.toLowerCase().trim(),
      phoneNo,
      aadharNo,
      dateOfBirth: new Date(dateOfBirth),
      pancard: pancard.toUpperCase().trim(),
      residenceAddress: residenceAddress.trim(),
      state: state.trim(),
      city: city.trim(),
      pincode,
      emailOtp,
      otpExpiry
    };

    pendingPodcastRegistrations.set(key, registrationData);

    // Send OTP via email
    try {
      const emailHtml = getPodcastTemplate(name, emailOtp, "complete your registration");

      await sendEmail(
        email,
        "Podcast Platform - Email Verification OTP",
        `Hello ${name},\n\nThank you for registering with our Podcast Platform. Please use the following OTP to verify your email address:\n\nOTP: ${emailOtp}\n\nThis OTP is valid for 3 minutes only.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nPodcast Platform Team`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    // ✅ 7. Send OTP successfully
    // Success response
    res.status(200).json({
      success: true,
      message: "OTP sent to your email. Please verify within 3 minutes.",
      data: {
        email: email.toLowerCase(),
        phoneNo: phoneNo
      }
    });

  } catch (error) {
    console.error("Podcast registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Verify OTP for podcast user registration
const verifyPodcastOtp = async (req, res) => {
  try {
    const { phoneNo, email, emailOtp } = req.body;

    // Find pending registration
    const key = `${email.toLowerCase()}|${phoneNo}`;
    const userData = pendingPodcastRegistrations.get(key);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "No registration found or OTP expired. Please register again."
      });
    }

    // Verify OTP
    if (userData.emailOtp !== emailOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check and try again."
      });
    }

    // Check if OTP is expired
    if (Date.now() > userData.otpExpiry) {
      pendingPodcastRegistrations.delete(key);
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please register again."
      });
    }

    // Create new user in database (only after successful OTP verification)
    const newUser = new PodcastUser({
      name: userData.name,
      gender: userData.gender,
      email: userData.email,
      phoneNo: userData.phoneNo,
      aadharNo: userData.aadharNo,
      dateOfBirth: userData.dateOfBirth,
      pancard: userData.pancard,
      residenceAddress: userData.residenceAddress,
      state: userData.state,
      city: userData.city,
      pincode: userData.pincode,
      isVerified: true,
      isActive: true,
      role: 'podcastuser'
    });

    await newUser.save();

    // Clean up pending registration
    pendingPodcastRegistrations.delete(key);

    // Generate token
    const token = generateToken(newUser._id);

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. Registration completed.",
      data: {
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phoneNo: newUser.phoneNo,
          role: newUser.role,
          isVerified: newUser.isVerified
        }
      }
    });

  } catch (error) {
    console.error("Podcast OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Send OTP for podcast user login
const sendPodcastLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await PodcastUser.findOne({
      email: email.toLowerCase(),
      isActive: true
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with provided email address"
      });
    }

    // Generate OTP
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database
    const otpData = new PodcastOtpStore({
      email: user.email,
      emailOtp,
      otpType: 'login'
    });

    await otpData.save();

    // Send OTP via email
    try {
      const emailHtml = getPodcastTemplate(user.name, emailOtp, "login to your account");

      await sendEmail(
        user.email,
        "Podcast Platform - Login OTP",
        `Hello ${user.name},\n\nYou requested to login to your Podcast Platform account. Please use the following OTP:\n\nOTP: ${emailOtp}\n\nThis OTP is valid for 3 minutes only.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nPodcast Platform Team`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    // Success response
    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your registered email"
    });

  } catch (error) {
    console.error("Send podcast login OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Verify OTP for podcast user login
const verifyPodcastLoginOtp = async (req, res) => {
  try {
    const { email, loginOtp } = req.body;

    // Find user to get email
    const user = await PodcastUser.findOne({
      email: email.toLowerCase(),
      isActive: true
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with provided email address"
      });
    }

    // Find valid OTP
    const otpData = await PodcastOtpStore.findValidOtp(null, user.email, 'login');

    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new one."
      });
    }

    // Verify OTP
    if (otpData.emailOtp !== loginOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check and try again."
      });
    }

    // Mark OTP as used
    await otpData.markAsUsed();

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "User account is not verified"
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNo: user.phoneNo,
          role: user.role,
          isVerified: user.isVerified,
          profileImage: user.profileImage,
          bio: user.bio,
          podcastStats: user.podcastStats
        }
      }
    });

  } catch (error) {
    console.error("Podcast login OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Resend OTP for podcast users
const resendPodcastOtp = async (req, res) => {
  try {
    const { email, phoneNo } = req.body;

    // Find pending registration
    const key = `${email.toLowerCase()}|${phoneNo}`;
    const userData = pendingPodcastRegistrations.get(key);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "No pending registration found. Please register again."
      });
    }

    // Generate new OTP
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 3 * 60 * 1000; // 3 minutes

    // Update stored OTP
    userData.emailOtp = emailOtp;
    userData.otpExpiry = otpExpiry;
    pendingPodcastRegistrations.set(key, userData);

    // Send OTP via email
    try {
      const emailHtml = getPodcastTemplate(userData.name, emailOtp, "verify your email address");

      await sendEmail(
        email,
        "Podcast Platform - New Verification OTP",
        `Hello ${userData.name},\n\nYou requested a new OTP. Please use the following OTP to verify your email address:\n\nOTP: ${emailOtp}\n\nThis OTP is valid for 3 minutes only.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nPodcast Platform Team`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    // Success response
    res.status(200).json({
      success: true,
      message: "New OTP sent successfully to your email"
    });

  } catch (error) {
    console.error("Resend podcast OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Get podcast user profile
const getPodcastUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await PodcastUser.findById(userId).select('-aadharNo -pancard');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error("Get podcast user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

const updatePodcastUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.isVerified;
    delete updateData.iinsafId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Validate required fields
    if (updateData.email && !updateData.email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    if (updateData.phoneNo && updateData.phoneNo.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits"
      });
    }

    // Check if email is already taken by another user
    if (updateData.email) {
      const existingUser = await PodcastUser.findOne({
        email: updateData.email,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email address is already in use"
        });
      }
    }

    // Check if phone number is already taken by another user
    if (updateData.phoneNo) {
      const existingUser = await PodcastUser.findOne({
        phoneNo: updateData.phoneNo,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number is already in use"
        });
      }
    }

    // Update the user profile
    const updatedUser = await PodcastUser.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  registerPodcastUser,
  verifyPodcastOtp,
  sendPodcastLoginOtp,
  verifyPodcastLoginOtp,
  resendPodcastOtp,
  getPodcastUserProfile,
  updatePodcastUserProfile
};

