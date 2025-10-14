const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");

// Get press user profile
const getPressProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Getting press profile for user:", userId);

    const user = await PressConferenceUser.findById(userId).select('-password -otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log("Press profile found:", {
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      isVerified: user.isVerified
    });

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        organization: user.organization,
        pressConferenceId: user.pressConferenceId,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("Error getting press profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Update press user profile
const updatePressProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, email, mobile, organization } = req.body;
    
    console.log("Updating press profile for user:", userId);
    console.log("Update data:", { name, email, mobile, organization });

    // Validate required fields
    if (!name || !email || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and mobile are required fields"
      });
    }

    // Check if email is already taken by another user
    const existingUser = await PressConferenceUser.findOne({
      email: email,
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already taken by another user"
      });
    }

    // Check if mobile is already taken by another user
    const existingMobile = await PressConferenceUser.findOne({
      mobile: mobile,
      _id: { $ne: userId }
    });

    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is already taken by another user"
      });
    }

    // Update user profile
    const updatedUser = await PressConferenceUser.findByIdAndUpdate(
      userId,
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        organization: organization ? organization.trim() : "",
        updatedAt: new Date()
      },
      { new: true, select: '-password -otp -otpExpires' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log("Press profile updated successfully:", {
      name: updatedUser.name,
      email: updatedUser.email,
      mobile: updatedUser.mobile
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        organization: updatedUser.organization,
        pressConferenceId: updatedUser.pressConferenceId,
        isVerified: updatedUser.isVerified,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error("Error updating press profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  getPressProfile,
  updatePressProfile
};
