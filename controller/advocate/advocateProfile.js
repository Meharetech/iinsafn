const AdvocateUser = require("../../models/advocateUser/advocateUser");

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login again.",
      });
    }

    // Find user by ID
    const user = await AdvocateUser.findById(userId).select("-password -mobileOtp -emailOtp -otpExpiry -resetOTP -resetOTPExpires");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Advocate user not found",
      });
    }

    return res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        aadharNo: user.aadharNo,
        pancard: user.pancard,
        residenceAddress: user.residenceAddress,
        state: user.state,
        city: user.city,
        pincode: user.pincode,
        profileImage: user.profileImage,
        specialization: user.specialization,
        experience: user.experience,
        barAssociationCourt: user.barAssociationCourt,
        uniqueId: user.uniqueId,
        advocateId: user.advocateId,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("Advocate profile error:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

module.exports = getProfile;

