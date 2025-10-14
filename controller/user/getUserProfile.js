const User = require("../../models/userModel/userModel");

const getUserProfile = async (req, res) => {
  try {
    const userId = req.userId; // userId is set in your middleware

    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
    });
  }
};

const gotoDashboard = async(req,res)=>{

  try {
    // userAuthenticate middleware attaches user ID to req.userId
    const userId = req.userId;

    // 1️⃣ Check if user exists
    const user = await User.findById(userId).select("-password"); // exclude password
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 2️⃣ Prepare dashboard data (you can customize as needed)
    const dashboardData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      walletBalance: user.walletBalance || 0, // example field
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 3️⃣ Send response
    return res.status(200).json({
      success: true,
      message: "User dashboard data fetched successfully",
      data: dashboardData
    });
  } catch (error) {
    console.error("Error in gotoDashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard data"
    });
  }
};


module.exports = {getUserProfile, gotoDashboard}
