const jwt = require("jsonwebtoken");
const ryvSchema = require("../../models/userModel/RaiseYourVoiceModel/raiseYourVoiceUsers");

const ryvUserAuthenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token contains userId
    if (!decoded.userId) {
      return res.status(401).json({ message: "Invalid RYV user token format" });
    }

    // Find RYV user in database
    const user = await ryvSchema.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "RYV user not found" });
    }

    // Add user info to request object
    req.user = user;
    req.userId = decoded.userId;
    req.userRole = "ryvuser"; // Set specific role for RYV users
    
    next();
  } catch (error) {
    console.error("RYV user authentication error:", error.message);
    res.status(401).json({ message: `Authentication error: ${error.message}` });
  }
};

module.exports = ryvUserAuthenticate;

