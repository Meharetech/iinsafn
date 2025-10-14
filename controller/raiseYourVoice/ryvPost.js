const ryvPostModel = require("../../models/raiseYourVoicePost/ryvPostSchema");
const Admin = require("../../models/adminModels/adminRegistration/adminSchema");
const sendEmail = require("../../utils/sendEmail");
const notifyOnWhatsapp = require("../../utils/notifyOnWhatsapp");
const Templates = require("../../utils/whatsappTemplates");
const { getRaiseYourVoiceTemplate } = require("../../utils/emailTemplates");
const ryvPost = async (req, res) => {
  try {
    const {
      name,
      phoneNo,
      email,
      dateOfBirth,
      state,
      city,
      residenceAddress,
      gender,
      aadharNo,
      pancard,
      description,
      targetUserType,
    } = req.body;

    console.log("that is data from frontend for posting ", req.body);

    // Validate mandatory fields
    if (
      !name ||
      !phoneNo ||
      !email ||
      !dateOfBirth ||
      !state ||
      !city ||
      !residenceAddress ||
      !gender ||
      !aadharNo ||
      !pancard ||
      !description ||
      !targetUserType
    ) {
      return res
        .status(400)
        .json({ message: "All fields including description and target user type are required." });
    }

    // Media upload check
    let imagePath = "";
    let videoPath = "";

    if (req.files?.image?.[0]) {
      imagePath = req.files.image[0].path;
    }

    if (req.files?.video?.[0]) {
      videoPath = req.files.video[0].path;
    }

    if (!imagePath && !videoPath) {
      return res
        .status(400)
        .json({ message: "Either image or video is required." });
    }

    const newPost = new ryvPostModel({
      userId: req.userId,
      name,
      phoneNo,
      email,
      dateOfBirth,
      state,
      city,
      residenceAddress,
      gender,
      aadharNo,
      pancard,
      description,
      targetUserType,
      image: imagePath,
      video: videoPath,
      status: "under review",
    });

    await newPost.save();

    // 🔹 Find SuperAdmins and SubAdmins assigned to "Raise Your Voice"
const admins = await Admin.find({
  $or: [
    { role: "superadmin" },
    { role: "subadmin", assignedSections: "Raise Your Voice" },
  ],
}).select("email mobileNumber name");


// 🔹 Notify Admins (Email + WhatsApp)
// for (const admin of admins) {

//   // 📧 Email notification
//   if (admin.email) {

//     try {
//       await sendEmail({
//         to: admin.email.trim(), // ensure string without spaces
//         subject: "New Raise Your Voice Post Submitted",
//         text: `A new RYV post has been submitted by ${name} (${email}).\n\nDescription: ${description}\n\nCheck the admin dashboard for details.`,
//       });
//     } catch (err) {
//       console.error("❌ Email sending failed for", admin.email, "Error:", err);
//     }
//   } else {
//     console.warn("⚠️ Admin has no email:", admin);
//   }

//   // 📱 WhatsApp notification
//   if (admin.mobileNumber) {

//     try {
//       await notifyOnWhatsapp(
//         admin.mobileNumber,
//         Templates.NOTIFY_TO_ADMIN_AFTER_RYV_AD_CREATED, // must match AiSensy campaign name
//         [
//           admin.name || "Admin", // {{1}}
//           name,                  // {{2}}
//           email,                 // {{3}}
//           description,           // {{4}}
//         ]
//       );
//     } catch (err) {
//       console.error("❌ WhatsApp sending failed for", admin.mobileNumber, "Error:", err);
//     }
//   } else {
//     console.warn("⚠️ Admin has no mobileNumber:", admin);
//   }
// }



for (const admin of admins) {
  // 📧 Email notification
  if (admin.email) {
    try {
      const emailHtml = getRaiseYourVoiceTemplate(admin.name || "Admin", name, email, description);
      
      await sendEmail(
        admin.email.trim(), // ✅ ensure string without spaces
        "New Raise Your Voice Post Submitted - iinsaf Platform",
        `A new RYV post has been submitted by ${name} (${email}).\n\nDescription: ${description}\n\nCheck the admin dashboard for details.`,
        emailHtml
      );
      console.log(`✅ Email sent to ${admin.email}`);
    } catch (err) {
      console.error("❌ Email sending failed for", admin.email, "Error:", err.message);
    }
  } else {
    console.warn("⚠️ Admin has no email:", admin);
  }

  // 📱 WhatsApp notification
  if (admin.mobileNumber) {
    try {
      await notifyOnWhatsapp(
        admin.mobileNumber,
        Templates.NOTIFY_TO_ADMIN_AFTER_RYV_AD_CREATED, // must match AiSensy campaign name
        [
          admin.name || "Admin", // {{1}}
          name,                  // {{2}}
          email,                 // {{3}}
          description,           // {{4}}
        ]
      );
      console.log(`✅ WhatsApp sent to ${admin.mobileNumber}`);
    } catch (err) {
      console.error("❌ WhatsApp sending failed for", admin.mobileNumber, "Error:", err.message);
    }
  } else {
    console.warn("⚠️ Admin has no mobileNumber:", admin);
  }
}


    res.status(201).json({
      success: true,
      message: "Post submitted successfully and is under review.",
      post: newPost,
    });
  } catch (error) {
    console.error("Error while submitting RYV post:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = ryvPost;
