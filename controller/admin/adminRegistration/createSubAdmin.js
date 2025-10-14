const Admin = require("../../../models/adminModels/adminRegistration/adminSchema");
const AdminOtp = require("../../../models/adminModels/adminRegistration/tempAdminOtpStore");
const bcrypt = require("bcrypt");
const {
  sendOtpViaSMS,
  sendOtpViaEmail,
} = require("../../../controller/user/registerUser");

// const createSubAdmin = async (req, res) => {
//   console.log("Received data for creating sub admin:", req.body);

//   const {
//     name,
//     email,
//     mobileNumber,
//     password,
//     assignedSections = [],
//     accessPaths = [],
//   } = req.body;

//   try {
//     const existingAdmin = await Admin.findOne({ email });
//     if (existingAdmin) {
//       return res
//         .status(409)
//         .json({ message: "Admin with this email already exists." });
//     }

//     // Normalize assignedSections
//     const normalizedAssignedSections = Array.isArray(assignedSections)
//       ? assignedSections.map((s) => s.toLowerCase())
//       : [assignedSections.toLowerCase()];

//     const normalizedAccessPaths = Array.isArray(accessPaths)
//       ? accessPaths
//       : [accessPaths];

//     console.log("Normalized assignedSections:", normalizedAssignedSections);
//     console.log("Normalized accessPaths:", normalizedAccessPaths);

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
//     const mobileOtp = Math.floor(100000 + Math.random() * 900000).toString();

//     // Create or update manually
//     let tempAdmin = await AdminOtp.findOne({ email });

//     if (!tempAdmin) {
//       tempAdmin = new AdminOtp({ email });
//     }

//     tempAdmin.set({
//       name,
//       mobileNumber,
//       password: hashedPassword,
//       emailOtp,
//       mobileOtp,
//       assignedSections: normalizedAssignedSections,
//       accessPaths: normalizedAccessPaths,
//       expiresAt: Date.now() + 10 * 60 * 1000,
//     });

//     await tempAdmin.save(); // ✅ this ensures all fields are saved

//     await sendOtpViaEmail(email, emailOtp);
//     await sendOtpViaSMS(mobileNumber, mobileOtp, name);

//     return res.status(200).json({
//       success: true,
//       message:
//         "OTPs sent to email and mobile. Please verify to complete registration.",
//     });
//   } catch (error) {
//     console.error("Subadmin creation error:", error);
//     return res.status(500).json({ message: "Internal Server Error" });
//   }
// };







const createSubAdmin = async (req, res) => {
  console.log("Received data for creating sub admin:", req.body);

  const {
    name,
    email,
    mobileNumber,
    password,
    assignedSections = [],
    accessPaths = [],
  } = req.body;

  try {
    // ✅ 1. Required fields check
    if (!name || !email || !mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number, and password are required.",
      });
    }

    // ✅ 2. Format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }
    if (!mobileRegex.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number format.",
      });
    }

    // ✅ 3. Check if already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin with this email already exists.",
      });
    }

    // ✅ 4. Normalize safely
    const normalizedAssignedSections = Array.isArray(assignedSections)
      ? assignedSections.map((s) => s.toLowerCase())
      : assignedSections
      ? [assignedSections.toLowerCase()]
      : [];

    const normalizedAccessPaths = Array.isArray(accessPaths)
      ? accessPaths
      : accessPaths
      ? [accessPaths]
      : [];

    console.log("Normalized assignedSections:", normalizedAssignedSections);
    console.log("Normalized accessPaths:", normalizedAccessPaths);

    // ✅ 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ 6. Generate OTPs
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const mobileOtp = crypto.randomInt(100000, 999999).toString();

    // ✅ 7. Create or update temp admin record
    let tempAdmin = await AdminOtp.findOne({ email });
    if (!tempAdmin) {
      tempAdmin = new AdminOtp({ email });
    }

    tempAdmin.set({
      name,
      mobileNumber,
      password: hashedPassword,
      emailOtp,
      mobileOtp,
      assignedSections: normalizedAssignedSections,
      accessPaths: normalizedAccessPaths,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
    });

    await tempAdmin.save();

    // ✅ 8. Try sending OTPs but don’t break flow if fails
    try {
      await sendOtpViaEmail(email, emailOtp);
    } catch (emailErr) {
      console.error("⚠️ Email OTP sending failed:", emailErr.message);
    }

    try {
      await sendOtpViaSMS(mobileNumber, mobileOtp, name);
    } catch (smsErr) {
      console.error("⚠️ SMS OTP sending failed:", smsErr.message);
    }

    // ✅ 9. Success response
    return res.status(200).json({
      success: true,
      message:
        "Sub-admin created successfully. OTPs sent (check logs if any failed).",
    });
  } catch (error) {
    console.error("Sub-admin creation error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};




const deleteSubAdmin = async (req, res) => {
  try {
    const subAdminId = req.params.id;

    // Find the admin by id
    const admin = await Admin.findById(subAdminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Sub-admin not found",
      });
    }

    // Prevent deleting a superadmin
    if (admin.role === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "You cannot delete a superadmin",
      });
    }

    // Delete the sub-admin
    await Admin.findByIdAndDelete(subAdminId);

    res.status(200).json({
      success: true,
      message: "Sub-admin deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sub-admin:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting sub-admin",
      error: error.message,
    });
  }
};






const getSubAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    const subAdmin = await Admin.findById(id).select("-password"); // hide password
    if (!subAdmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    // Prevent fetching another superadmin
    if (subAdmin.role === "superadmin") {
      return res.status(403).json({ message: "Cannot edit a Superadmin" });
    }

    res.status(200).json({ success: true, data: subAdmin });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching subadmin", error: error.message });
  }
};

/**
 * Update subadmin details (including password if provided)
 */
const updateSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, assignedSections, accessPaths, password } = req.body;

    const subAdmin = await Admin.findById(id);
    if (!subAdmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    // Prevent editing another superadmin
    if (subAdmin.role === "superadmin") {
      return res.status(403).json({ message: "Cannot edit a Superadmin" });
    }

    // Update fields if provided
    if (name) subAdmin.name = name;
    if (email) subAdmin.email = email;
    if (phone) subAdmin.phone = phone;
    if (assignedSections) subAdmin.assignedSections = assignedSections;
    if (accessPaths) subAdmin.accessPaths = accessPaths;

    // ✅ Update password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      subAdmin.password = hashedPassword;
    }

    await subAdmin.save();

    res.status(200).json({
      success: true,
      message: "Subadmin details updated successfully",
      data: {
        _id: subAdmin._id,
        name: subAdmin.name,
        email: subAdmin.email,
        phone: subAdmin.phone,
        role: subAdmin.role,
        assignedSections: subAdmin.assignedSections,
        accessPaths: subAdmin.accessPaths,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error updating subadmin", error: error.message });
  }
};





module.exports = {createSubAdmin, deleteSubAdmin, getSubAdminById, updateSubAdmin}
