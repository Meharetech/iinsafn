const genrateIdCard = require("../../../../models/reporterIdGenrate/genrateIdCard");
const uploadToCloudinary = require("../../../../utils/uploadToCloudinary");

const adminUpdateIdCard = async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  // Start with basic fields
  const updateFields = {
    name: req.body.name,
    designation: req.body.designation,
    email: req.body.email,
    mobileNo: req.body.mobileNo,
    aadharNo: req.body.aadharNo,
    bloodGroup: req.body.bloodGroup,
    dateOfBirth: req.body.dateOfBirth,
    channelName: req.body.channelName,
    channelType: req.body.channelType,
    plateform: req.body.plateform,
    ResidentialAddress: req.body.ResidentialAddress,
    city: req.body.city,
    state: req.body.state,
    pincode: req.body.pincode,
  };

  // ✅ Handle profile image upload
  if (files && files.profileImage && files.profileImage[0]) {
    try {
      const profileUpload = await uploadToCloudinary(
        files.profileImage[0].path,
        "reporters/idcards"
      );
      if (profileUpload?.secure_url) {
        updateFields.image = profileUpload.secure_url;
        console.log("✅ Profile image updated:", profileUpload.secure_url);
      }
    } catch (error) {
      console.error("❌ Profile image upload failed:", error);
      return res.status(500).json({
        message: "Profile image upload failed",
        error: error.message
      });
    }
  }

  // ✅ Handle channel logo upload
  if (files && files.channelLogo && files.channelLogo[0]) {
    try {
      const channelLogoUpload = await uploadToCloudinary(
        files.channelLogo[0].path,
        "reporters/logos"
      );
      if (channelLogoUpload?.secure_url) {
        updateFields.channelLogo = channelLogoUpload.secure_url;
        console.log("✅ Channel logo updated:", channelLogoUpload.secure_url);
      }
    } catch (error) {
      console.error("❌ Channel logo upload failed:", error);
      return res.status(500).json({
        message: "Channel logo upload failed",
        error: error.message
      });
    }
  }

  // ✅ Safely parse channelLinks
  if (req.body.channelLinks) {
    try {
      updateFields.channelLinks = JSON.parse(req.body.channelLinks);
    } catch (err) {
      return res.status(400).json({
        message: "Invalid format for channelLinks",
      });
    }
  }

  try {
    const updatedCard = await genrateIdCard.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedCard) {
      return res.status(404).json({ message: "ID card not found." });
    }

    return res.status(200).json({
      message: "ID card updated successfully.",
      updatedCard,
    });
  } catch (error) {
    console.error("Error updating ID card:", error);
    return res.status(500).json({ message: "Server error while updating ID card." });
  }
};

module.exports = adminUpdateIdCard;
