const jwt = require("jsonwebtoken");
const AdvocateUser = require("../../models/advocateUser/advocateUser");

const advocateAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "No token provided" 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Advocate Auth - Decoded token:", decoded);
    
    // Check token payload - advocate login uses { id, role, userType }
    const userId = decoded.id;
    
    if (!userId) {
      console.log("Advocate Auth - Token missing id field");
      return res.status(401).json({ 
        success: false,
        message: "Invalid token format" 
      });
    }
    
    // Verify role is advocate
    if (decoded.role !== "advocate" && decoded.userType !== "advocate") {
      console.log("Advocate Auth - Invalid role:", decoded.role, decoded.userType);
      return res.status(403).json({ 
        success: false,
        message: "Access denied. Advocate role required." 
      });
    }
    
    // Find advocate user in database
    const user = await AdvocateUser.findById(userId);
    console.log("Advocate Auth - User found:", user ? "Yes" : "No");
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Advocate user not found" 
      });
    }
    
    // Add user info to request object
    req.user = {
      id: user._id,
      _id: user._id,
      ...user.toObject()
    };
    req.userId = user._id;
    req.userRole = "advocate";
    
    console.log("🔍 Advocate Auth Debug - User authenticated:", {
      userId: user._id,
      advocateId: user.advocateId,
      role: "advocate"
    });
    
    next();
  } catch (error) {
    console.error("Advocate authentication error:", error.message);
    res.status(401).json({ 
      success: false,
      message: `Authentication error: ${error.message}` 
    });
  }
};

module.exports = advocateAuth;

