const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");
const Adpost = require("../../models/advertismentPost/advertisementPost");
const mongoose = require("mongoose"); // ✅ Add mongoose for transactions
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const fs = require("fs");

const submitAdProof = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const reporterId = req.user._id;
    const reporterIinsafId = req.user.iinsafId;
    const { adId, channelName, platform, videoLink, duration } = req.body;
    const screenshotFile = req.file;

    if (
      !screenshotFile ||
      !channelName ||
      !platform ||
      !videoLink ||
      !duration ||
      !adId
    ) {
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

    // ✅ Get the ad
    const adPost = await Adpost.findById(adId).session(session);
    if (!adPost) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Ad not found" });
    }

    // ✅ Find reporter entry
    const reporterEntry = adPost.acceptRejectReporterList.find(
      (r) => r.reporterId.toString() === reporterId.toString()
    );

    if (!reporterEntry || (reporterEntry.postStatus !== "accepted" && reporterEntry.postStatus !== "submitted")) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "You are not authorized to submit proof for this ad",
      });
    }

    // ✅ Check 14-hour expiry from acceptedAt
    const acceptedAt = new Date(reporterEntry.acceptedAt);
    const now = new Date();
    const diffInMs = now - acceptedAt;
    const fourteenHoursInMs = 14 * 60 * 60 * 1000;

    if (diffInMs > fourteenHoursInMs) {
      // ❌ Reject due to delay
      await Adpost.updateOne(
        { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
        {
          $set: {
            "acceptRejectReporterList.$.postStatus": "rejected",
            "acceptRejectReporterList.$.accepted": false,
            "acceptRejectReporterList.$.adProof": false,
            "acceptRejectReporterList.$.rejectNote":
              "Ad rejected for you because of uploading after expiry time",
            "acceptRejectReporterList.$.iinsafId": reporterIinsafId,
          },
        },
        { session }
      );

      await session.commitTransaction();
      return res.status(403).json({
        message:
          "Ad rejected: You tried to upload proof after the 14-hour expiry time.",
      });
    }

    // ✅ Add proof if within time
    const newProof = {
      reporterId,
      iinsafId: reporterIinsafId,
      screenshot: screenshotUrl, // ✅ Use Cloudinary URL
      channelName,
      platform,
      videoLink,
      duration,
        status: "pending", // ✅ Initial proof submitted, waiting for completion screenshot
      userRole: req.user.role === "influencer" ? "Influencer" : "Reporter",
    };

    let adProofDoc = await reporterAdProof.findOne({ adId }).session(session);

    if (!adProofDoc) {
      adProofDoc = new reporterAdProof({
        adId,
        requiredReporter: adPost.requiredReporter,
        baseView: adPost.baseView,
        finalReporterPrice: adPost.finalReporterPrice,
        adType: adPost.adType,
        proofs: [newProof],
        runningAdStatus: "running",
      });
    } else {
      const existingProofIndex = adProofDoc.proofs.findIndex(
        (proof) => proof.reporterId.toString() === reporterId.toString()
      );
      
      if (existingProofIndex !== -1) {
        // Update existing proof (for resubmission after rejection)
        // Clear rejection fields when resubmitting
        const updatedProof = {
          ...newProof,
          adminRejectNote: "",
          adminRejectedBy: null,
          adminRejectedByName: "",
          adminRejectedAt: null
        };
        adProofDoc.proofs[existingProofIndex] = updatedProof;
      } else {
        // Add new proof
        adProofDoc.proofs.push(newProof);
      }
    }

    await adProofDoc.save({ session });

    // ✅ Update reporter's status in the ad
    await Adpost.updateOne(
      { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
      {
        $set: {
          "acceptRejectReporterList.$.adProof": true,
          "acceptRejectReporterList.$.postStatus": "submitted",
          "acceptRejectReporterList.$.submittedAt": new Date(),
        },
        $unset: {
          "acceptRejectReporterList.$.rejectedAt": 1,
          "acceptRejectReporterList.$.rejectNote": 1,
          "acceptRejectReporterList.$.adminRejectedBy": 1,
          "acceptRejectReporterList.$.adminRejectedByName": 1,
        },
      },
      { session }
    );

    await session.commitTransaction();

    res
      .status(201)
      .json({ message: "Proof submitted successfully", data: adProofDoc });
  } catch (error) {
    await session.abortTransaction();
    console.error("Submit Proof Error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

const reporterGetRunningAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    console.log("Reporter ID:", reporterId);

    // 1. Find all adProof documents where this reporter has a proof with status 'pending', 'submitted', or 'rejected'
    const runningAds = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          reporterId: reporterId,
          status: { $in: ["pending", "submitted", "rejected"] },
        },
      },
    });

    // 2. Filter proofs to include only the current reporter's entry (pending, submitted, or rejected)
    const filteredAds = runningAds.map((doc) => {
      const reporterProof = doc.proofs.find(
        (proof) => proof.reporterId.toString() === reporterId.toString() && 
                  (proof.status === "pending" || proof.status === "submitted" || proof.status === "rejected")
      );

      return {
        _id: doc._id,
        adId: doc.adId,
        baseView: doc.baseView,
        finalReporterPrice: doc.finalReporterPrice,
        adType: doc.adType,
        runningAdStatus: doc.runningAdStatus,
        requiredReporter: doc.requiredReporter,
        proofs: reporterProof ? [reporterProof] : [],
      };
    });

    console.log("Filtered Running Ads Data:", filteredAds);

    res.status(200).json({
      success: true,
      message: "Running ads fetched successfully (includes pending, submitted, and rejected proofs)",
      data: filteredAds,
    });
  } catch (error) {
    console.error("Error fetching running ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching running ads",
    });
  }
};

const reporterGetCompletedAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Step 1: Find all documents that include this reporter with completed status
    const completedAds = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          reporterId: reporterId,
          status: "completed",
        },
      },
    });

    // Step 2: Filter each document to include only this reporter's proof
    const filteredAds = completedAds.map((doc) => {
      const reporterProof = doc.proofs.find(
        (proof) =>
          proof.reporterId.toString() === reporterId.toString() &&
          proof.status === "completed"
      );

      return {
        _id: doc._id,
        adId: doc.adId,
        baseView: doc.baseView,
        finalReporterPrice: doc.finalReporterPrice,
        adType: doc.adType,
        runningAdStatus: doc.runningAdStatus,
        requiredReporter: doc.requiredReporter,
        proofs: reporterProof ? [reporterProof] : [],
      };
    });

    res.status(200).json({
      success: true,
      message: "Completed ads fetched successfully",
      data: filteredAds,
    });
  } catch (error) {
    console.error("Error fetching completed ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching completed ads",
    });
  }
};

module.exports = {
  submitAdProof,
  reporterGetRunningAds,
  reporterGetCompletedAds,
};



