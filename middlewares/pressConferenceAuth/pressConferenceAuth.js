const jwt = require("jsonwebtoken");
const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");

const pressConferenceAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Press Conference Auth - Authorization header:", authHeader);
    
    if (!authHeader) {
      console.log("Press Conference Auth - No authorization header provided");
      return res.status(401).json({
        success: false,
        message: "Access denied. No authorization header provided.",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.log("Press Conference Auth - Invalid authorization format");
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid authorization format.",
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    console.log("Press Conference Auth - Token received:", token ? "Present" : "Missing");
    console.log("Press Conference Auth - Token value:", token);
    
    if (!token || token === "null" || token === "undefined") {
      console.log("Press Conference Auth - Invalid token value");
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token.",
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Press Conference Auth - Decoded token:", decoded);
    
    // Check if token has the required fields for press conference
    if (!decoded.id) {
      console.log("Press Conference Auth - Token missing id field");
      return res.status(401).json({
        success: false,
        message: "Invalid press conference token format.",
      });
    }
    
    // Find the user in the database
    const user = await PressConferenceUser.findById(decoded.id);
    console.log("Press Conference Auth - User found:", user ? "Yes" : "No");
    
    if (!user) {
      console.log("Press Conference Auth - User not found in database");
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      console.log("Press Conference Auth - User not verified");
      return res.status(401).json({
        success: false,
        message: "Account not verified. Please verify your account first.",
      });
    }

    // Add user to request object
    req.user = user;
    req.userId = decoded.id;
    req.userRole = "press";
    console.log("Press Conference Auth - User added to request:", user._id);
    next();
  } catch (error) {
    console.error("Press Conference Auth Error:", error);
    console.error("Press Conference Auth Error name:", error.name);
    console.error("Press Conference Auth Error message:", error.message);
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error during authentication.",
    });
  }
};

module.exports = pressConferenceAuth;
