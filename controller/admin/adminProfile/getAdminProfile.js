const Admin = require("../../../models/adminModels/adminRegistration/adminSchema");

const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findById(adminId).select("-password");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({
      success: true,
      message: "Admin profile fetched successfully",
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        mobileNumber: admin.mobileNumber,
        joinDate: admin.createdAt
        // other admin fields
      }
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = getAdminProfile;
