/**
 * Middleware to verify admin access to specific sections
 * @param {string} requiredSection - The section that requires access permission
 * @returns {function} Express middleware function
 */
const verifyAdminAccess = (requiredSection) => {
  return async (req, res, next) => {
    try {
      // User and role should already be set by adminAuthenticate middleware
      if (!req.user || !req.userRole) {
        return res.status(401).json({ message: "Unauthorized - missing user information" });
      }

      // Super admin has access to all sections
      if (req.userRole === "superadmin") {
        return next();
      }

      // For subadmins, check if they have access to the required section
      if (req.userRole === "subadmin") {
        if (!req.user.assignedSections.includes(requiredSection)) {
          return res.status(403).json({
            message: `Access denied. You are not assigned to the '${requiredSection}' section.`,
          });
        }
        return next();
      }

      return res.status(403).json({ message: "Access denied. Invalid role." });
    } catch (err) {
      console.error("Access check failed:", err);
      return res.status(500).json({ message: "Internal server error." });
    }
  };
};

module.exports = verifyAdminAccess;
