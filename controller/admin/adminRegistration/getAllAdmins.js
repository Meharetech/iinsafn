const Admin = require("../../../models/adminModels/adminRegistration/adminSchema");

const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find(); // Fetch all admin documents
    res.status(200).json({
      success: true,
      message: "Admins fetched successfully",
      data: admins,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admins",
      error: error.message,
    });
  }
};

module.exports = getAllAdmins;
