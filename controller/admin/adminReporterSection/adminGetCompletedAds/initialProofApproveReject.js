const reporterAdProof = require("../../../../models/reporterAdProof/reporterAdProof");
const Adpost = require("../../../../models/advertismentPost/advertisementPost");
const User = require("../../../../models/userModel/userModel");
const sendEmail = require("../../../../utils/sendEmail");
const notifyOnWhatsapp = require("../../../../utils/notifyOnWhatsapp");
const Templates = require("../../../../utils/whatsappTemplates");
const mongoose = require("mongoose");

/**
 * Admin Approves INITIAL Proof (when reporter first submits screenshot after accepting ad)
 * Status changes: pending -> approved
 */
const adminApproveInitialProof = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adId, reporterId } = req.body;
    const adminId = req.user._id;
    const adminName = req.user.name || req.user.email || "Admin";

    console.log("🎯 Approving initial proof for:", { adId, reporterId });

    // 1. Update the proof status from "pending" to "approved" 
    const updated = await reporterAdProof.findOneAndUpdate(
      {
        adId,
        "proofs.reporterId": reporterId,
        "proofs.status": "pending" // ✅ Only process pending proofs (initial proof submitted)
      },
      {
        $set: {
          "proofs.$[elem].status": "approved",
          "proofs.$[elem].initialProofApprovedAt": new Date(),
          "proofs.$[elem].initialProofApprovedBy": adminId,
          "proofs.$[elem].initialProofApprovedByName": adminName,
        },
        $unset: {
          "proofs.$[elem].initialProofRejectedAt": 1,
          "proofs.$[elem].initialProofRejectNote": 1,
        }
      },
      {
        new: true,
        arrayFilters: [{ "elem.reporterId": reporterId }],
        session
      }
    );

    if (!updated) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Initial proof not found or not in pending status"
      });
    }

    // 2. Update reporter's status in Adpost
    await Adpost.updateOne(
      { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
      {
        $set: {
          "acceptRejectReporterList.$.postStatus": "accepted", // ✅ Set to "accepted" so ad shows again for final proof submission
          "acceptRejectReporterList.$.adProof": true, // ✅ Keep adProof as true (initial proof exists)
          "acceptRejectReporterList.$.initialProofApproved": true,
          "acceptRejectReporterList.$.initialProofApprovedAt": new Date(),
          "acceptRejectReporterList.$.initialProofApprovedBy": adminId,
        },
        $unset: {
          "acceptRejectReporterList.$.initialProofRejectedAt": 1,
          "acceptRejectReporterList.$.initialProofRejectNote": 1,
        }
      },
      { session }
    );

    await session.commitTransaction();

    console.log("✅ Initial proof approved successfully");

    // 3. Notify user (reporter or influencer)
    const user = await User.findById(reporterId);
    const userType = user?.role === "influencer" ? "Influencer" : "Reporter";

    if (user) {
      // Email notification
      await sendEmail(
        user.email,
        "Initial Proof Approved ✅",
        `Hello ${user.name},\n\nGood news! Your initial proof for Ad ID: ${adId} has been approved by Admin: ${adminName}.\n\nYou can now proceed to complete the task and submit the final completion screenshot.\n\nRegards,\nIINSAF Team`
      );

      // WhatsApp notification
      if (user.mobile) {
        await notifyOnWhatsapp(
          user.mobile,
          Templates.ADMIN_APPROVE_INITIAL_PROOF_NOTIFY_TO_REPORTER, // Template works for both reporters and influencers
          [
            user.name, // {{1}}
            adId, // {{2}}
            adminName, // {{3}}
          ]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Initial proof approved successfully. ${userType} can now proceed with the task.`,
      data: {
        adId,
        reporterId,
        status: "approved",
        approvedBy: adminName,
        approvedAt: new Date(),
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Error approving initial proof:", err);
    res.status(500).json({
      success: false,
      error: "Server error while approving initial proof"
    });
  } finally {
    session.endSession();
  }
};

/**
 * Admin Rejects INITIAL Proof (when reporter first submits screenshot after accepting ad)
 * Status changes: pending -> rejected
 * Reporter must resubmit initial proof
 */
const adminRejectInitialProof = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adId, reporterId, adminNote } = req.body;
    const adminId = req.user._id;
    const adminName = req.user.name || req.user.email || "Admin";

    if (!adminNote || !adminNote.trim()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for rejecting the initial proof"
      });
    }

    console.log("❌ Rejecting initial proof for:", { adId, reporterId, adminNote });

    // 1. Update the proof status from "pending" to "rejected"
    const updated = await reporterAdProof.findOneAndUpdate(
      {
        adId,
        "proofs.reporterId": reporterId,
        "proofs.status": "pending" // ✅ Only reject pending proofs (initial proof submitted)
      },
      {
        $set: {
          "proofs.$[elem].status": "rejected",
          "proofs.$[elem].initialProofRejectNote": adminNote.trim(),
          "proofs.$[elem].initialProofRejectedAt": new Date(),
          "proofs.$[elem].initialProofRejectedBy": adminId,
          "proofs.$[elem].initialProofRejectedByName": adminName,
        },
        $unset: {
          "proofs.$[elem].screenshot": 1,
          "proofs.$[elem].channelName": 1,
          "proofs.$[elem].platform": 1,
          "proofs.$[elem].videoLink": 1,
          "proofs.$[elem].duration": 1,
          "proofs.$[elem].submittedAt": 1,
          "proofs.$[elem].initialProofApprovedAt": 1,
          "proofs.$[elem].initialProofApprovedBy": 1,
        }
      },
      {
        new: true,
        arrayFilters: [{ "elem.reporterId": reporterId }],
        session
      }
    );

    if (!updated) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Initial proof not found or not in pending status"
      });
    }

    // 2. Update reporter's status in Adpost
    await Adpost.updateOne(
      { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
      {
        $set: {
          "acceptRejectReporterList.$.postStatus": "accepted", // Back to accepted status
          "acceptRejectReporterList.$.adProof": false, // No valid proof anymore
          "acceptRejectReporterList.$.initialProofRejectedAt": new Date(),
          "acceptRejectReporterList.$.initialProofRejectNote": adminNote.trim(),
          "acceptRejectReporterList.$.initialProofRejectedBy": adminId,
          "acceptRejectReporterList.$.initialProofRejectedByName": adminName,
        },
        $unset: {
          "acceptRejectReporterList.$.submittedAt": 1,
          "acceptRejectReporterList.$.initialProofApproved": 1,
          "acceptRejectReporterList.$.initialProofApprovedAt": 1,
          "acceptRejectReporterList.$.initialProofApprovedBy": 1,
        }
      },
      { session }
    );

    await session.commitTransaction();

    console.log("❌ Initial proof rejected successfully");

    // 3. Notify user (reporter or influencer)
    const user = await User.findById(reporterId);
    const userType = user?.role === "influencer" ? "Influencer" : "Reporter";

    if (user) {
      // Email notification
      await sendEmail(
        user.email,
        "Initial Proof Rejected ❌",
        `Hello ${user.name},\n\nYour initial proof for Ad ID: ${adId} has been rejected by Admin: ${adminName}.\n\nReason: ${adminNote}\n\nPlease review the feedback and resubmit a proper initial proof screenshot to proceed with this task.\n\nRegards,\nIINSAF Team`
      );

      // WhatsApp notification
      if (user.mobile) {
        await notifyOnWhatsapp(
          user.mobile,
          Templates.ADMIN_REJECT_INITIAL_PROOF_NOTIFY_TO_REPORTER, // Template works for both reporters and influencers
          [
            user.name, // {{1}}
            adId, // {{2}}
            adminNote, // {{3}}
            adminName, // {{4}}
          ]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Initial proof rejected. ${userType} must resubmit.`,
      data: {
        adId,
        reporterId,
        status: "rejected",
        rejectNote: adminNote,
        rejectedBy: adminName,
        rejectedAt: new Date(),
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Error rejecting initial proof:", err);
    res.status(500).json({
      success: false,
      error: "Server error while rejecting initial proof"
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get all INITIAL proofs awaiting admin approval (status: "pending")
 */
const getPendingInitialProofs = async (req, res) => {
  try {
    console.log("🔍 Fetching all pending initial proofs...");

    const pendingProofs = await reporterAdProof.find({
      "proofs.status": "pending"
    }).populate({
      path: "adId",
      select: "mediaDescription mediaType imageUrl videoUrl adType requiredViews"
    }).populate({
      path: "proofs.reporterId",
      select: "name email mobile iinsafId role state city organization"
    }).lean();

    if (!pendingProofs || pendingProofs.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No pending initial proofs found",
        data: []
      });
    }

    // Filter and format the proofs
    const formattedData = [];
    pendingProofs.forEach(doc => {
      doc.proofs.forEach(proof => {
        if (proof.status === "pending") {
          formattedData.push({
            adProofId: doc._id,
            adId: doc.adId?._id,
            adTitle: doc.adId?.mediaDescription || "N/A",
            adType: doc.adId?.adType,
            mediaType: doc.adId?.mediaType,
            mediaUrl: doc.adId?.mediaType === "video" ? doc.adId?.videoUrl : doc.adId?.imageUrl,

            reporterId: proof.reporterId?._id,
            reporterName: proof.reporterId?.name,
            reporterEmail: proof.reporterId?.email,
            reporterMobile: proof.reporterId?.mobile,
            iinsafId: proof.iinsafId || proof.reporterId?.iinsafId,
            userRole: proof.reporterId?.role,

            screenshot: proof.screenshot,
            submittedAt: proof.submittedAt,
            status: proof.status
          });
        }
      });
    });

    console.log(`✅ Found ${formattedData.length} pending initial proofs`);

    res.status(200).json({
      success: true,
      message: "Pending initial proofs fetched successfully",
      count: formattedData.length,
      data: formattedData
    });
  } catch (error) {
    console.error("❌ Error fetching pending initial proofs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pending initial proofs"
    });
  }
};

module.exports = {
  adminApproveInitialProof,
  adminRejectInitialProof,
  getPendingInitialProofs,
};

