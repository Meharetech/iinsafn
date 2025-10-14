const User = require('../../models/userModel/userModel');
const Admin = require('../../models/adminModels/adminRegistration/adminSchema');
const RyvUser = require('../../models/userModel/RaiseYourVoiceModel/raiseYourVoiceUsers');
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify user has the required role
 * @param {string|string[]} requiredRoles - The role(s) required to access the route
 * @returns {function} Express middleware function
 */
const roleAuth = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      
      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if we have userId or adminId in the token
      const userId = decoded.userId?.id || decoded.userId;
      const adminId = decoded.adminId;
      
      // Normalize requiredRoles to array
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      
      let user = null;
      let userRole = null;
      
      // Check if token contains adminId
      if (adminId) {
        user = await Admin.findById(adminId);
        if (!user) {
          return res.status(401).json({ message: "Invalid admin token" });
        }
        userRole = user.role; // superadmin or subadmin
        
        // For admin users, check assigned sections if they're a subadmin
        if (userRole === 'subadmin' && req.originalUrl) {
          // This is a simplified check - you might want to implement more sophisticated path matching
          const hasAccess = user.assignedSections.some(section => 
            req.originalUrl.includes(section.toLowerCase())
          );
          
          if (!hasAccess) {
            return res.status(403).json({ message: "You don't have access to this section" });
          }
        }
      } 
      // Check if it's a regular user
      else if (userId) {
        // First try regular user model
        user = await User.findById(userId);
        
        // If not found, try RYV user model
        if (!user) {
          user = await RyvUser.findById(userId);
          if (user) {
            userRole = "ryvuser";
          }
        } else {
          userRole = user.role; // Advertiser, Influencer, or Reporter
        }
        
        if (!user) {
          return res.status(401).json({ message: "Invalid user token" });
        }
      } else {
        return res.status(401).json({ message: "Invalid token format" });
      }
      
      // Check if user role is in the required roles
      if (!roles.includes(userRole) && !roles.includes('all')) {
        return res.status(403).json({ 
          message: `Access denied. Required role: ${roles.join(' or ')}`
        });
      }
      
      // Add user and role to request object
      req.user = user;
      req.userRole = userRole;
      if (userId) req.userId = userId;
      if (adminId) req.adminId = adminId;
      
      next();
    } catch (error) {
      console.error("Role authentication error:", error.message);
      res.status(401).json({ message: `Authentication error: ${error.message}` });
    }
  };
};

module.exports = roleAuth;
