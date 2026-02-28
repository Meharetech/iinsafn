const Admin = require("../../../models/adminModels/adminRegistration/adminSchema");
const AdminOtp = require("../../../models/adminModels/adminRegistration/tempAdminOtpStore");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendOtpViaEmail } = require("../../../controller/user/registerUser");

const adminRegistration = async (req, res) => {
  try {
    const { name, email, mobileNumber, password } = req.body;

    if (!name || !email || !mobileNumber || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate name field
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: "Name must be a valid non-empty string" });
    }

    // Check if admin already exists with email in Admin panel
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res
        .status(409)
        .json({ message: "Admin already registered with this email in Admin panel" });
    }

    // Generate OTPs
    const emailOtp = crypto.randomInt(100000, 999999).toString();

    const hashedPassword = await bcrypt.hash(password, 10);

    // Save to AdminOtp schema temporarily
    await AdminOtp.findOneAndUpdate(
      { email },
      {
        name: name.trim(), // Ensure name is trimmed
        email,
        mobileNumber,
        password: hashedPassword,
        emailOtp,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      },
      { upsert: true }
    );

    // Send OTPs
    await sendOtpViaEmail(email, emailOtp);

    return res.status(200).json({
      success: true,
      message:
        "OTP sent to email. Please verify to complete registration.",
    });
  } catch (error) {
    console.error("Error in registering admin:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

const verifyAdminOtp = async (req, res) => {
  try {
    const { email, emailOtp } = req.body;

    if (!email || !emailOtp) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const otpRecord = await AdminOtp.findOne({ email });
    if (!otpRecord) {
      return res
        .status(404)
        .json({ message: "OTP record not found. Please resend OTP." });
    }

    if (otpRecord.emailOtp !== emailOtp.trim()) {
      return res.status(400).json({ message: "Invalid OTPs provided." });
    }

    if (Date.now() > otpRecord.expiresAt) {
      return res
        .status(400)
        .json({ message: "OTP has expired. Please resend OTP." });
    }

    // Check if Super Admin exists
    const superAdminExists = await Admin.findOne({ role: "superadmin" });

    // Decide role: first admin = superadmin, else subadmin
    const role = superAdminExists ? "subadmin" : "superadmin";

    // For subadmins, we must prevent duplicates
    if (role === "subadmin") {
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) {
        await AdminOtp.deleteOne({ email });
        return res
          .status(409)
          .json({ message: "Sub Admin with this email already exists." });
      }
    }

    // Create the admin
    const newAdmin = new Admin({
      name: otpRecord.name,
      email: otpRecord.email,
      mobileNumber: otpRecord.mobileNumber,
      password: otpRecord.password,
      role: role,
      assignedSections:
        role === "superadmin"
          ? ["reporter", "advertiser", "press", "others"]
          : otpRecord.assignedSections || [],
      accessPaths:
        role === "superadmin"
          ? ["/admin/dashboard"] // or any default
          : otpRecord.accessPaths || [],
    });


    await newAdmin.save();
    await AdminOtp.deleteOne({ email }); // Cleanup after success

    const payload = {
      adminId: newAdmin._id,
      role: newAdmin.role,
      assignedSections: newAdmin.assignedSections || []
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
      (err, token) => {
        if (err) throw err;
        return res.status(201).json({
          message: `${role === "superadmin" ? "Super Admin" : "Sub Admin"
            } registered successfully`,
          token,
          role: newAdmin.role,
          user: {
            id: newAdmin._id,
            name: newAdmin.name,
            email: newAdmin.email,
            role: newAdmin.role
          }
        });
      }
    );
  } catch (error) {
    console.error("Error verifying admin OTP:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};


// const adminLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const admin = await Admin.findOne({ email });

//     if (!admin) {
//       return res.status(404).json({ message: "Admin not found" });
//     }

//     const isMatch = await bcrypt.compare(password, admin.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Wrong Password" });
//     }

//     // Generate token with admin-specific payload
//     const payload = {
//       adminId: admin._id,
//       role: admin.role,
//       assignedSections: admin.assignedSections || []
//     };

//     // Determine redirectPath
//     let redirectPath = "/admin/dashboard"; // default for super admin

//     if (admin.role !== "superadmin") {
//       redirectPath = admin.accessPaths?.[0] || "/admin/dashboard";
//     }

//     jwt.sign(
//       payload, 
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" },
//       (err, token) => {
//         if (err) throw err;
//         res.status(200).json({
//           success: true,
//           message: "Login successful",
//           token,
//           role: admin.role,
//           redirectPath,
//           assignedSections: admin.assignedSections || [],
//           accessPaths: admin.accessPaths || [],
//           user: {
//             id: admin._id,
//             name: admin.name,
//             email: admin.email,
//             role: admin.role
//           }
//         });
//       }
//     );
//   } catch (error) {
//     console.error("Admin login error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Input validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // ✅ Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found for this email" });
    }

    // ✅ Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // ✅ JWT Payload
    const payload = {
      adminId: admin._id,
      role: admin.role,
      assignedSections: admin.assignedSections || []
    };

    // ✅ Determine redirect path
    let redirectPath = "/admin/dashboard"; // Default for super admin
    if (admin.role !== "superadmin") {
      redirectPath = admin.accessPaths?.[0] || "/admin/dashboard";
    }

    // ✅ Generate JWT token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
      (err, token) => {
        if (err) {
          console.error("JWT generation error:", err);
          return res.status(500).json({ success: false, message: "Token generation failed" });
        }

        res.status(200).json({
          success: true,
          message: "Login successful",
          token,
          role: admin.role,
          redirectPath,
          assignedSections: admin.assignedSections || [],
          accessPaths: admin.accessPaths || [],
          user: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role
          }
        });
      }
    );
  } catch (error) {
    console.error("Admin login error:", error.message || error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


module.exports = { adminRegistration, verifyAdminOtp, adminLogin };
