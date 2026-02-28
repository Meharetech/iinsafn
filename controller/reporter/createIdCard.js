const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");
const User = require("../../models/userModel/userModel");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const Admins = require("../../models/adminModels/adminRegistration/adminSchema");
const sendEmail = require("../../utils/sendEmail");
const notifyOnWhatsapp = require("../../utils/notifyOnWhatsapp");
const Templates = require("../../utils/whatsappTemplates");

const createIdCard = async (req, res) => {
  try {
    const id = req.user._id;
    const reporterDetails = req.user;
    console.log("reporter data from middleware:", reporterDetails);
    const files = req.files;
    const { channelName, channelType, plateform, platformLinks } = req.body;

    console.log("that is the req. body", req.body);
    // 1. Check if user exists and is a reporter or influencer
    const user = await User.findOne({ _id: id, role: { $in: ["Reporter", "Influencer"] } });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found or not a Reporter/Influencer" });
    }

    // Step 2: Check if reporter already generated ID card
    const existingIdCard = await genrateIdCard.findOne({ reporter: id });
    if (existingIdCard) {
      // Allow resubmission only if the previous application was rejected
      if (existingIdCard.status === "Rejected") {
        // Delete the rejected application to allow new submission
        await genrateIdCard.findByIdAndDelete(existingIdCard._id);
        console.log("Deleted rejected ID card application for resubmission");
      } else {
        return res.status(400).json({
          message:
            "You have already generated your ID card. Only one is allowed.",
        });
      }
    }

    // Step 3: Validate required fields
    if (!channelName) {
      return res
        .status(400)
        .json({ message: "channelName required. Please fill the form" });
    }
    if (!channelType) {
      return res
        .status(400)
        .json({ message: "channelType required. Please fill the form" });
    }
    if (!plateform) {
      return res
        .status(400)
        .json({ message: "plateform required. Please fill the form" });
    }

    // Step 4: Validate both files are present
    if (
      !files ||
      !files.profileImage ||
      !files.profileImage[0] ||
      !files.channelLogo ||
      !files.channelLogo[0]
    ) {
      return res
        .status(400)
        .json({ message: "Both profile image and channel logo are required." });
    }

    // Step 5: Upload profile image
    const profileUpload = await uploadToCloudinary(
      files.profileImage[0].path,
      "reporters/idcards"
    );
    if (!profileUpload?.secure_url) {
      return res.status(500).json({ message: "Profile image upload failed" });
    }

    const profileImageUrl = profileUpload.secure_url;

    // Step 6: Upload channel logo
    const channelLogoUpload = await uploadToCloudinary(
      files.channelLogo[0].path,
      "reporters/logos"
    );
    if (!channelLogoUpload?.secure_url) {
      return res.status(500).json({ message: "Channel logo upload failed" });
    }

    const channelLogoUrl = channelLogoUpload.secure_url;

    // ✅ Add verification log AFTER successful image uploads
    console.log("✅ Both images uploaded successfully:", {
      profileImageUrl: profileUpload.secure_url,
      channelLogoUrl: channelLogoUpload.secure_url,
    });

    const parsedPlatformLinks = JSON.parse(platformLinks || "{}");

    const formattedChannelLinks = Object.entries(parsedPlatformLinks).map(
      ([platform, link]) => {
        let formattedLink = String(link).trim();
        if (formattedLink && !/^https?:\/\//i.test(formattedLink)) {
          formattedLink = "https://" + formattedLink;
        }
        return {
          platform,
          link: formattedLink,
        };
      }
    );

    const newIdCard = new genrateIdCard({
      reporter: reporterDetails._id,
      name: reporterDetails.name,
      aadharNo: reporterDetails.aadharNo,
      mobileNo: reporterDetails.mobile,
      email: reporterDetails.email,
      dateOfBirth: reporterDetails.dateOfBirth,
      designation: reporterDetails.role,
      bloodGroup: reporterDetails.bloodType,
      ResidentialAddress: reporterDetails.residenceaddress,
      state: reporterDetails.state,
      city: reporterDetails.city,
      pincode: reporterDetails.pincode,
      channelLogo: channelLogoUrl,
      image: profileImageUrl,
      channelName,
      channelType,
      plateform,
      channelLinks: formattedChannelLinks, // ✅ correctly formatted
      status: "Under Review",
      // iinsafId will be generated during approval process
    });

    console.log("that is the new id card after verification ", newIdCard);

    const savedIdCard = await newIdCard.save();

    if (reporterDetails.email) {
      await sendEmail(
        reporterDetails.email,
        "Your ID Card Application Submitted",
        `Hello ${reporterDetails.name},\n\nYour ID Card has been successfully submitted and is under review.\n\nYou will be notified once the admin approves or rejects your application.\n\nRegards,\nTeam`
      );
    }

    // 📱 WhatsApp notification to reporter
    if (reporterDetails.mobile) {
      await notifyOnWhatsapp(
        reporterDetails.mobile,
        Templates.NOTIFY_TO_REPORTER_AFTER_SUCCESSFULLY_APPLY_ID_CARD, // "id_applied_template"
        [reporterDetails.name] // <-- must match AiSensy template placeholders
      );
    }

    //  Send notification to admins
    const admins = await Admins.find({
      $or: [
        { role: "superadmin" },
        { role: "subadmin", assignedSections: "reporter" },
      ],
    });

    for (const admin of admins) {
      if (admin.email) {
        await sendEmail(
          admin.email,
          "New Reporter ID Card Submitted",
          `Hello ${admin.name},\n\nReporter ${reporterDetails.name} has submitted their ID Card for verification.\n\nPlease review and approve/reject.\n\nRegards,\nTeam`
        );
      }

      // 📱 WhatsApp
      if (admin.mobileNumber) {
        await notifyOnWhatsapp(
          admin.mobileNumber,
          Templates.ID_CARD_APPLIED_NOTIFY_TO_ADMIN, // "admin_get_id_card_request_for_verify"
          [admin.name, reporterDetails.name] // <- must match AiSensy template placeholders
        );
      }
    }

    res.status(201).json({
      message: "ID Card created successfully",
      data: savedIdCard,
    });
  } catch (error) {
    console.error("Error in createIdCard:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports = createIdCard;
