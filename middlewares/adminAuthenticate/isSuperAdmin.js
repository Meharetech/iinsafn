/**
 * Middleware to check if the user is a Super Admin
 */
const isSuperAdmin = (req, res, next) => {
  if (req.userRole !== "superadmin") {
    return res.status(403).json({ 
      message: "Access denied. Only Super Admin can perform this action." 
    });
  }
  next();
};

module.exports = isSuperAdmin;
