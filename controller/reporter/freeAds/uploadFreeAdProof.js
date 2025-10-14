// const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");
// const FreeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");

// const uploadFreeAdProof = async (req, res) => {
//   try {
//     console.log("Incoming proof submission:", req.body);

//     const reporterId = req.user._id;
//     const { adId, channelName, platform, videoLink, duration } = req.body;
//     const screenshot = req.file?.path;

//     // Validate required fields
//     if (!adId || !screenshot || !channelName || !platform || !videoLink || !duration) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // Check if ad exists
//     const freeAd = await FreeAdModel.findById(adId);
//     if (!freeAd) {
//       return res.status(404).json({ message: "Free Ad not found" });
//     }

//     // Check if reporter has accepted the ad
//     const reporterEntry = freeAd.acceptedReporters.find(
//       (r) => r.reporterId.toString() === reporterId.toString()
//     );

//     if (!reporterEntry || reporterEntry.postStatus !== "accepted") {
//       return res.status(403).json({
//         message: "You are not authorized to submit proof for this ad",
//       });
//     }

//     // Check if proof already submitted
//     const alreadySubmitted = await FreeAdProof.findOne({ adId, reporterId });
//     if (alreadySubmitted) {
//       return res.status(400).json({ message: "Proof already submitted for this ad" });
//     }

//     // Create and save proof
// const newProof = new FreeAdProof({
//   adId,
//   reporterId,
//   screenshot,
//   channelName,
//   videoLink,
//   platform,
//   duration,
//   status: "submitted",
// });

// await newProof.save();

// // Update reporter's status in the ad
// await FreeAdModel.updateOne(
//   { _id: adId, "acceptedReporters.reporterId": reporterId },
//   {
//     $set: {
//       "acceptedReporters.$.adProof": true,
//       "acceptedReporters.$.postStatus": "submitted"
//     }
//   }
// );


//     res.status(201).json({
//       success: true,
//       message: "Proof submitted successfully",
//       data: newProof,
//     });

//   } catch (error) {
//     console.error("Free Ad Proof Submission Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// module.exports = uploadFreeAdProof;








const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");
const FreeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const genrateIdCard = require("../../../models/reporterIdGenrate/genrateIdCard");
const mongoose = require('mongoose');
const uploadToCloudinary = require("../../../utils/uploadToCloudinary");
const fs = require("fs");

const uploadFreeAdProof = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log("Incoming proof submission:", req.body);

    const reporterId = req.user._id;
    const { adId, channelName, platform, videoLink, duration } = req.body;
    const screenshotFile = req.file;

    // ✅ Validate required fields
    if (!adId || !screenshotFile || !channelName || !platform || !videoLink || !duration) {
      await session.abortTransaction();
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Upload screenshot to Cloudinary
    let screenshotUrl = null;
    try {
      console.log("Uploading screenshot to Cloudinary...");
      const cloudinaryResult = await uploadToCloudinary(screenshotFile.path);
      screenshotUrl = cloudinaryResult.secure_url;
      console.log("Screenshot uploaded successfully:", screenshotUrl);
      
      // ✅ Delete local file after successful upload
      if (fs.existsSync(screenshotFile.path)) {
        fs.unlinkSync(screenshotFile.path);
        console.log("Local file deleted:", screenshotFile.path);
      }
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      await session.abortTransaction();
      return res.status(500).json({ message: "Failed to upload screenshot" });
    }

    // ✅ Check if ad exists
    const freeAd = await FreeAdModel.findById(adId).session(session);
    if (!freeAd) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Free Ad not found" });
    }

    // ✅ Check if reporter has accepted the ad
    const reporterEntry = freeAd.acceptedReporters.find(
      (r) => r.reporterId.toString() === reporterId.toString()
    );

    if (!reporterEntry || reporterEntry.postStatus !== "accepted") {
      await session.abortTransaction();
      return res.status(403).json({
        message: "You are not authorized to submit proof for this ad",
      });
    }

    // ✅ Check if proof already submitted
    const existingProof = await FreeAdProof.findOne({ adId, reporterId }).session(session);
    if (existingProof && existingProof.status !== "rejected") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Proof already submitted for this ad" });
    }

    // ✅ Fetch reporter's iinsafId from generateIdCard collection (using reporter field)
    const idCard = await genrateIdCard.findOne({ reporter: reporterId }).select("iinsafId").session(session);
    if (!idCard) {
      await session.abortTransaction();
      return res.status(404).json({ message: "ID Card not found for this reporter" });
    }

    // ✅ Create or update proof with iinsafId
    let newProof;
    if (existingProof && existingProof.status === "rejected") {
      // Update existing rejected proof
      existingProof.screenshot = screenshotUrl;
      existingProof.channelName = channelName;
      existingProof.videoLink = videoLink;
      existingProof.platform = platform;
      existingProof.duration = duration;
      existingProof.status = "submitted";
      existingProof.adminRejectNote = undefined; // Clear rejection note
      await existingProof.save({ session });
      newProof = existingProof;
    } else {
      // Create new proof
      newProof = new FreeAdProof({
        adId,
        reporterId,
        iinsafId: idCard.iinsafId,
        screenshot: screenshotUrl, // ✅ Use Cloudinary URL instead of local path
        channelName,
        videoLink,
        platform,
        duration,
        status: "submitted",
      });
      await newProof.save({ session });
    }

    // ✅ Update reporter's status in the ad
    await FreeAdModel.updateOne(
      { _id: adId, "acceptedReporters.reporterId": reporterId },
      {
        $set: {
          "acceptedReporters.$.adProof": true,
          "acceptedReporters.$.postStatus": "submitted",
          "acceptedReporters.$.submittedAt": new Date(),
        },
      },
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Proof submitted successfully",
      data: newProof,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Free Ad Proof Submission Error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

module.exports = uploadFreeAdProof;
