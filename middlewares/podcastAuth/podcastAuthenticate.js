const jwt = require("jsonwebtoken");
const PodcastUser = require("../../models/podcastUser/podcastUserSchema");

const podcastAuthenticate = async (req, res, next) => {
  try {
    console.log("Podcast auth middleware called");
    console.log("Headers:", req.headers);
    
    const token = req.header("Authorization")?.replace("Bearer ", "");
    console.log("Token:", token ? "Present" : "Missing");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await PodcastUser.findById(decoded.userId).select('-aadharNo -pancard');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found."
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact support."
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: "Account not verified. Please verify your account first."
      });
    }

    // Add user to request object
    req.user = {
      userId: user._id,
      email: user.email,
      phoneNo: user.phoneNo,
      role: user.role,
      name: user.name
    };
    
    console.log("User authenticated successfully:", req.user);

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token."
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again."
      });
    }

    console.error("Podcast authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authentication."
    });
  }
};

module.exports = podcastAuthenticate;

