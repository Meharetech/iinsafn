const jwt = require("jsonwebtoken");
const User = require('../../models/userModel/userModel');

const userAuthenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token contains userId
    if (!decoded.userId || !decoded.userId.id) {
      return res.status(401).json({ message: "Invalid user token format" });
    }
    
    // Find user in database
    const user = await User.findById(decoded.userId.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Add user info to request object
    req.user = user;
    req.userId = decoded.userId.id;
    req.userRole = user.role;
    
    console.log("🔍 Auth Debug - User authenticated:", {
      userId: user._id,
      iinsafId: user.iinsafId,
      role: user.role
    });
    
    next();
  } catch (error) {
    console.error("User authentication error:", error.message);
    res.status(401).json({ message: `Authentication error: ${error.message}` });
  }
};

module.exports = userAuthenticate;
