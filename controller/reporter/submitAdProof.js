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

    // ✅ Handle local file storage instead of Cloudinary for high performance
    let screenshotUrl = null;
    if (screenshotFile) {
      // Use the local server URL. In production, this would be your domain.
      const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
      screenshotUrl = `${baseUrl}/upload/${screenshotFile.filename}`;
      console.log("✅ Proof stored locally on server:", screenshotUrl);
    } else {
      await session.abortTransaction();
      return res.status(400).json({ message: "Screenshot file is required" });
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

    // ✅ Allow submission if:
    // 1. postStatus is "accepted" (first time submission)
    // 2. postStatus is "accepted" with initialProofRejectedAt (resubmission after initial proof rejection)
    if (!reporterEntry || (reporterEntry.postStatus !== "accepted" && reporterEntry.postStatus !== "submitted")) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "You are not authorized to submit proof for this ad. Please accept the ad first.",
      });
    }

    // ✅ Check if this is a resubmission after initial proof rejection
    const existingProofDoc = await reporterAdProof.findOne({ adId }).session(session);
    const existingProof = existingProofDoc?.proofs?.find(
      (p) => p.reporterId.toString() === reporterId.toString()
    );

    // If proof exists and status is "rejected", this is a resubmission of initial proof
    // Allow it only if initial proof was rejected (not final proof rejection)
    if (existingProof && existingProof.status === "rejected") {
      // Check if this is initial proof rejection (has initialProofRejectedAt) or final proof rejection
      // If it has initialProofRejectedAt, it's initial proof rejection - allow resubmission
      // If it doesn't have initialProofRejectedAt but has adminRejectedAt, it's final proof rejection - don't allow
      if (!existingProof.initialProofRejectedAt && existingProof.adminRejectedAt) {
        await session.abortTransaction();
        return res.status(403).json({
          message: "Your final proof was rejected. Please contact admin for assistance.",
        });
      }
      // If initial proof was rejected, allow resubmission
      console.log("✅ Allowing resubmission of initial proof after rejection");
    }

    // ✅ Check 14-hour expiry from acceptedAt - REMOVED (User can submit anytime)
    // const acceptedAt = new Date(reporterEntry.acceptedAt);
    // const now = new Date();
    // const diffInMs = now - acceptedAt;
    // const fourteenHoursInMs = 14 * 60 * 60 * 1000;

    // if (diffInMs > fourteenHoursInMs) {
    //   // ❌ Reject due to delay
    //   await Adpost.updateOne(
    //     { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
    //     {
    //       $set: {
    //         "acceptRejectReporterList.$.postStatus": "rejected",
    //         "acceptRejectReporterList.$.accepted": false,
    //         "acceptRejectReporterList.$.adProof": false,
    //         "acceptRejectReporterList.$.rejectNote":
    //           "Ad rejected for you because of uploading after expiry time",
    //         "acceptRejectReporterList.$.iinsafId": reporterIinsafId,
    //       },
    //     },
    //     { session }
    //   );

    //   await session.commitTransaction();
    //   return res.status(403).json({
    //     message:
    //       "Ad rejected: You tried to upload proof after the 14-hour expiry time.",
    //   });
    // }

    // ✅ Add proof if within time
    const newProof = {
      reporterId,
      iinsafId: reporterIinsafId,
      screenshot: screenshotUrl, // ✅ Use Cloudinary URL
      channelName,
      platform,
      videoLink,
      duration,
      submittedAt: new Date(), // ✅ Track when initial proof was submitted
      status: "pending", // ✅ Initial proof submitted - pending admin approval
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
        // Clear rejection fields when resubmitting initial proof
        const updatedProof = {
          ...newProof,
          // Clear final proof rejection fields
          adminRejectNote: "",
          adminRejectedBy: null,
          adminRejectedByName: "",
          adminRejectedAt: null,
          // ✅ Clear initial proof rejection fields when resubmitting
          initialProofRejectedAt: null,
          initialProofRejectedBy: null,
          initialProofRejectedByName: "",
          initialProofRejectNote: "",
          // Clear completion screenshot if resubmitting initial proof
          completedTaskScreenshot: "",
          completionSubmittedAt: null
        };
        adProofDoc.proofs[existingProofIndex] = updatedProof;
      } else {
        // Add new proof
        adProofDoc.proofs.push(newProof);
      }

      // ✅ Ensure runningAdStatus is set to running
      adProofDoc.runningAdStatus = "running";
    }

    await adProofDoc.save({ session });

    // ✅ Update reporter's status in the ad
    await Adpost.updateOne(
      { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
      {
        $set: {
          "acceptRejectReporterList.$.adProof": true,
          "acceptRejectReporterList.$.postStatus": "pending", // ✅ Set to pending - waiting for admin to approve initial proof
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
    const User = require("../../models/userModel/userModel");
    const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");

    // ✅ VERIFICATION CHECK: Only verified users can access paid ads
    const user = await User.findById(reporterId);
    if (!user || !user.verifiedReporter) {
      const userType = user?.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `You are not a verified ${userType}. Please apply for and get your ID card approved first to access paid advertisements.`,
        data: []
      });
    }

    // ✅ Additional check: Verify ID card status is actually "Approved"
    const idCard = await genrateIdCard.findOne({ reporter: reporterId });
    if (!idCard || idCard.status !== "Approved") {
      const userType = user.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `Your ID card is not approved yet. Please wait for admin approval to access paid advertisements.`,
        data: []
      });
    }

    console.log("🔍 Reporter ID:", reporterId);

    // Debug: Check all proofs for this reporter
    const allProofs = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          reporterId: reporterId,
        },
      },
    });

    console.log("🔍 All proofs for reporter:", allProofs.length);
    allProofs.forEach((doc, index) => {
      const reporterProof = doc.proofs.find(
        (proof) => proof.reporterId.toString() === reporterId.toString()
      );
      console.log(`🔍 Proof ${index + 1}:`, {
        adId: doc.adId,
        status: reporterProof?.status,
        hasCompletedScreenshot: !!reporterProof?.completedTaskScreenshot,
        submittedAt: reporterProof?.submittedAt,
        completionSubmittedAt: reporterProof?.completionSubmittedAt
      });
    });

    // 1. Find all adProof documents where this reporter has a proof with status
    //    'pending', 'approved', 'submitted', or 'rejected'. We now include
    //    `approved` so reporters can see that admins have cleared their initial
    //    proof and allow them to progress towards the final submission.
    const runningAds = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          reporterId: reporterId,
          status: { $in: ["pending", "approved", "submitted", "rejected"] },
        },
      },
    });

    console.log("🔍 Found running ads:", runningAds.length);

    // 2. Filter proofs to include only the current reporter's entry (pending, submitted, or rejected)
    // 2. Filter proofs and join with Adpost to get acceptance time
    const filteredAds = await Promise.all(runningAds.map(async (doc) => {
      const reporterProof = doc.proofs.find(
        (proof) => proof.reporterId.toString() === reporterId.toString() &&
          ["pending", "approved", "submitted", "rejected"].includes(proof.status)
      );

      // Fetch the ad details to get acceptedAt
      const adDetails = await Adpost.findById(doc.adId);
      const reporterEntry = adDetails?.acceptRejectReporterList?.find(
        r => r.reporterId.toString() === reporterId.toString()
      );

      const acceptedAt = reporterEntry?.acceptedAt;
      const expiresAt = acceptedAt ? new Date(new Date(acceptedAt).getTime() + (72 * 60 * 60 * 1000)) : null;

      // Calculate if the task is expired.
      // A task is expired if it's NOT submitted and the current time is beyond expiresAt.
      // If submitted, it depends on whether it was submitted BEFORE expiresAt.
      const isSubmitted = reporterProof && ["submitted", "proof_submitted", "completed"].includes(reporterProof.status);
      const submissionTime = reporterProof?.completionSubmittedAt || reporterProof?.submittedAt;

      const isExpired = expiresAt ? (
        isSubmitted
          ? (submissionTime ? new Date(submissionTime) > expiresAt : false)
          : new Date() > expiresAt
      ) : false;

      return {
        _id: doc._id,
        adId: doc.adId,
        baseView: doc.baseView,
        finalReporterPrice: doc.finalReporterPrice,
        adType: doc.adType,
        runningAdStatus: doc.runningAdStatus,
        requiredReporter: doc.requiredReporter,
        proofs: reporterProof ? [reporterProof] : [],
        expiresAt: expiresAt,
        isExpired: isExpired
      };
    }));

    // 3. Filter out expired ads that are NOT yet submitted for review
    const finalFilteredAds = filteredAds.filter(ad => {
      const proof = ad.proofs[0];
      // If it's already submitted by the reporter, keep it in running (waiting for admin review)
      if (proof && ["submitted", "completed", "proof_submitted"].includes(proof.status)) {
        // Only keep if it wasn't expired at time of submission (or we can just keep all submitted for review)
        return true;
      }
      // If it's not submitted and is expired, filter it out
      return !ad.isExpired;
    });

    console.log("🔍 Final Running Ads Count (after expiry filter):", finalFilteredAds.length);

    res.status(200).json({
      success: true,
      message: "Running ads fetched successfully (excluding expired unsubmitted tasks).",
      data: finalFilteredAds,
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
    const User = require("../../models/userModel/userModel");
    const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");

    // ✅ VERIFICATION CHECK: Only verified users can access paid ads
    const user = await User.findById(reporterId);
    if (!user || !user.verifiedReporter) {
      const userType = user?.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `You are not a verified ${userType}. Please apply for and get your ID card approved first to access paid advertisements.`,
        data: []
      });
    }

    // ✅ Additional check: Verify ID card status is actually "Approved"
    const idCard = await genrateIdCard.findOne({ reporter: reporterId });
    if (!idCard || idCard.status !== "Approved") {
      const userType = user.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `Your ID card is not approved yet. Please wait for admin approval to access paid advertisements.`,
        data: []
      });
    }

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



