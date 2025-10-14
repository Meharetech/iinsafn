const jwt = require("jsonwebtoken");
const Admin = require('../../models/adminModels/adminRegistration/adminSchema');

const adminAuthenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    console.log("Admin auth - Token:", token);
    console.log("Admin auth - Authorization header:", req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Admin auth - Decoded token:", decoded);
    
    // Check if token contains adminId
    if (!decoded.adminId) {
      return res.status(401).json({ message: "Invalid admin token format" });
    }
    
    // Find admin in database
    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }
    
    // Add admin info to request object
    req.user = admin;
    req.admin = admin;
    req.adminId = decoded.adminId;
    req.userRole = admin.role;
    
    next();
  } catch (error) {
    console.error("Admin authentication error:", error);
    console.error("Error message:", error.message);
    console.error("Error name:", error.name);
    res.status(401).json({ message: `Authentication error: ${error.message}` });
  }
};

module.exports = adminAuthenticate;