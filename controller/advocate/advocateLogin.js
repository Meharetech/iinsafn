const bcrypt = require("bcrypt");
const AdvocateUser = require("../../models/advocateUser/advocateUser");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const emailLower = String(email).trim().toLowerCase();

    // ✅ Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // ✅ Find user by email
    const user = await AdvocateUser.findOne({ email: emailLower });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No Advocate user found with this email. Please register first.",
      });
    }

    // ✅ Check verification
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Advocate account not verified. Please verify your account before logging in.",
      });
    }

    // ✅ Check admin approval
    if (user.accountStatus !== "Approved") {
      return res.status(403).json({
        success: false,
        message: `Your account status is ${user.accountStatus || 'Pending'}. Please wait for admin approval.`,
      });
    }

    // ✅ Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ✅ Generate JWT token
    const payload = {
      id: user._id,
      role: "advocate",
      userType: "advocate",
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      token,
      role: "advocate",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: "advocate",
        advocateId: user.advocateId,
        specialization: user.specialization,
        experience: user.experience,
        barAssociationCourt: user.barAssociationCourt,
        profileImage: user.profileImage,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        aadharNo: user.aadharNo,
        pancard: user.pancard,
        residenceAddress: user.residenceAddress,
        state: user.state,
        city: user.city,
        pincode: user.pincode,
        uniqueId: user.uniqueId,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Advocate login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

module.exports = loginUser;

