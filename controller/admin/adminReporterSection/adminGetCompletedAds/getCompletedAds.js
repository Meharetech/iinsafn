const reporterAdProof = require("../../../../models/reporterAdProof/reporterAdProof");
const Wallet = require("../../../../models/Wallet/walletSchema");
const Adpost = require("../../../../models/advertismentPost/advertisementPost");
const sendEmail = require("../../../../utils/sendEmail");
const User = require("../../../../models/userModel/userModel");
const notifyOnWhatsapp = require("../../../../utils/notifyOnWhatsapp");
const Templates = require("../../../../utils/whatsappTemplates");
const mongoose = require("mongoose"); // ✅ Add mongoose for transactions

const getCompletedAds = async (req, res) => {
  try {
    const completedAds = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          status: "submitted", // ✅ Show submitted proofs awaiting admin approval
        },
      },
    });

    // Filter only relevant proofs in each document
    const filteredAds = completedAds.map((ad) => {
      const matchingProofs = ad.proofs.filter(
        (proof) => proof.status === "submitted"
      );

      return {
        ...ad._doc, // spread original ad data
        proofs: matchingProofs, // overwrite proofs with filtered
      };
    });

    res.status(200).json({
      success: true,
      message: "Filtered completed ads fetched successfully",
      data: filteredAds,
    });
  } catch (error) {
    console.error("Error in getCompletedAds:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while fetching completed ads",
    });
  }
};

const adminApproveAdsProof = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { adId, reporterId } = req.body;

    // 1. Update the proof status from "submitted" to "completed" (only if admin approves)
    const updated = await reporterAdProof.findOneAndUpdate(
      {
        adId,
        "proofs.reporterId": reporterId,
        "proofs.status": "submitted" // ✅ Only process submitted proofs (final proof submitted)
      },
      {
        $set: {
          "proofs.$[elem].status": "completed",
          "proofs.$[elem].adminApprovedAt": new Date(),
        },
      },
      {
        new: true,
        arrayFilters: [{ "elem.reporterId": reporterId }],
        session
      }
    );

    if (!updated) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Proof not found or not in submitted status for admin approval" });
    }

    // 2. Count how many proofs are fully completed
    const completedProofsCount = updated.proofs.filter(
      (proof) => proof.status === "completed"
    ).length;

    // 3. Update reporter's status in the ad
    await Adpost.updateOne(
      { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
      {
        $set: {
          "acceptRejectReporterList.$.postStatus": "completed",
          "acceptRejectReporterList.$.completedAt": new Date(),
        },
      },
      { session }
    );

    // 4. If all required reporters have completed, mark ad as completed
    let adCompleted = false;
    if (completedProofsCount >= updated.requiredReporter) {
      updated.runningAdStatus = "completed";
      await updated.save({ session });

      // 👉 Also update Adpost document
      await Adpost.findOneAndUpdate(
        { _id: adId, status: "running" },
        { $set: { status: "completed" } },
        { session }
      );

      adCompleted = true;
    }

    // 4. Get the current reporter's proof
    const proof = updated.proofs.find(
      (p) => p.reporterId.toString() === reporterId
    );
    const paymentAmount = updated.finalReporterPrice;

    if (!paymentAmount || paymentAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Invalid or missing payment amount" });
    }

    // 5. Get user role to determine wallet userType
    const userForWallet = await User.findById(reporterId);
    const userType = userForWallet?.role === "Influencer" ? "Influencer" : "Reporter";
    
    // 6. Wallet logic
    let wallet = await Wallet.findOne({
      userId: reporterId,
      userType: userType,
    });
    if (!wallet) {
      wallet = new Wallet({
        userId: reporterId,
        userType: userType,
        balance: 0,
      });
    }

    wallet.balance += paymentAmount;
    wallet.transactions.push({
      type: "credit",
      amount: paymentAmount,
      description: `Payment for ad work: ${adId}`,
    });

    await wallet.save();

    //  1. Notify user (reporter or influencer)
    console.log("that is my user that upload the proof", userForWallet);
    if (userForWallet) {
      const userTypeText = userForWallet.role === "Influencer" ? "influencer" : "reporter";
      await sendEmail(
        userForWallet.email,
        "Proof Approved",
        `Hi ${userForWallet.name},\n\nYour proof for Ad ID: ${adId} has been approved. 
        You have received ₹${paymentAmount} in your wallet.\n\nRegards,\nAdmin`
      );

      // 📱 WhatsApp notification
      if (userForWallet.mobile) {
        await notifyOnWhatsapp(
          userForWallet.mobile,
          Templates.ADMIN_APPROVE_PROOF_UPLOADED_NOTIFY_TO_REPORTER, // "admin_approve_proof_uploaded_notify_to_reporter"
          [
            userForWallet.name, // {{1}} -> user name
            adId, // {{2}} -> ad ID
            String(paymentAmount),     // {{3}} -> credited amount (must be string ✅)
          ]
        );
      }
    }

    //  2. Notify advertiser if ad is completed
    if (adCompleted) {
      const ad = await Adpost.findById(adId).populate("owner");
      if (ad && ad.owner) {
        await sendEmail(
          ad.owner.email,
          "Ad Completed",
          `Hi ${ad.owner.name},\n\nYour advertisement (Ad ID: ${adId}) has been successfully completed.\n\nRegards,\nAdmin`
        );

        // 📱 WhatsApp notification
        if (ad.owner.mobile) {
          await notifyOnWhatsapp(
            ad.owner.mobile,
            Templates.NOTIFY_TO_ADVERTISER_AFTER_AD_COMPLETED, // "notify_to_advertiser_after_ad_completed"
            [
              ad.owner.name, // {{1}} -> advertiser name
              adId, // {{2}} -> ad ID
            ]
          );
        }
      }
    }

    await session.commitTransaction();

    // 6. Respond
    res.json({
      success: true,
      message: "Task approved and payment credited to reporter wallet",
      updatedProof: proof,
      walletBalance: wallet.balance,
      runningAdStatus: updated.runningAdStatus,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Admin approval error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    session.endSession();
  }
};

async function adminRejectAdsProof(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { adId, reporterId, adminNote } = req.body;
    const adminId = req.user._id;
    const adminName = req.user.name || req.user.email || "Admin";

    const updated = await reporterAdProof.findOneAndUpdate(
      {
        adId,
        "proofs.reporterId": reporterId,
        "proofs.status": "submitted", // ✅ Only reject submitted proofs (final proof submitted)
      },
      {
        $set: {
          "proofs.$[elem].status": "rejected",
          "proofs.$[elem].adminRejectNote": adminNote || "",
          "proofs.$[elem].adminRejectedAt": new Date(),
          "proofs.$[elem].adminRejectedBy": adminId,
          "proofs.$[elem].adminRejectedByName": adminName,
        },
        $unset: {
          "proofs.$[elem].completedTaskScreenshot": 1, // ✅ Remove completion screenshot
          "proofs.$[elem].completionSubmittedAt": 1,   // ✅ Remove completion timestamp
        },
      },
      {
        new: true,
        arrayFilters: [{ "elem.reporterId": reporterId }],
        session
      }
    );

    if (!updated) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Proof not found or not in submitted status for rejection" });
    }

    // Update reporter's status in the ad - keep initial proof, only reject completion screenshot
    await Adpost.updateOne(
      { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
      {
        $set: {
          "acceptRejectReporterList.$.postStatus": "pending", // Reset to pending (initial proof is still valid)
          "acceptRejectReporterList.$.adProof": true, // Keep adProof as true (initial proof exists)
          "acceptRejectReporterList.$.rejectedAt": new Date(),
          "acceptRejectReporterList.$.rejectNote": adminNote || "Completion screenshot rejected by admin",
          "acceptRejectReporterList.$.adminRejectedBy": adminId,
          "acceptRejectReporterList.$.adminRejectedByName": adminName,
        },
        $unset: {
          "acceptRejectReporterList.$.completedAt": 1, // Remove completion timestamp
        },
      },
      { session }
    );

    await session.commitTransaction();

    // Get reporter details (for email)
    const reporter = await User.findById(reporterId);
    if (reporter) {
      await sendEmail(
        reporter.email,
        "Your Completion Screenshot Has Been Rejected ❌",
        `Hello ${
          reporter.name
        },\n\nYour completion screenshot for Ad ID: ${adId} has been rejected by Admin: ${adminName}.\nReason: ${
          adminNote || "No reason provided"
        }.\n\nYour initial proof is still valid. Please resubmit the completion screenshot.\n\nRegards,\nTeam`
      );

      // 📱 WhatsApp notification
      if (reporter.mobile) {
        await notifyOnWhatsapp(
          reporter.mobile,
          Templates.ADMIN_REJECT_PROOF_UPLOADED_NOTIFY_TO_REPORTER,
          [
            reporter.name,
            adId,
            adminNote || "No reason provided",
            adminName,
          ]
        );
      }
    }

    res.json({ message: "Task rejected with note", updated });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    session.endSession();
  }
}

const getFinalCompletedAds = async (req, res) => {
  try {
    // Step 1: Find documents where at least one proof is completed
    const completedAds = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          status: "completed",
        },
      },
    });

    // Step 2: For each matching ad, filter only the proofs with completed status
    const filteredAds = completedAds.map((ad) => {
      const matchingProofs = ad.proofs.filter(
        (proof) => proof.status === "completed"
      );

      return {
        ...ad._doc, // keep original ad fields
        proofs: matchingProofs, // replace with only completed proofs
      };
    });

    res.status(200).json({
      success: true,
      message: "Completed ads fetched successfully",
      data: filteredAds,
    });
  } catch (error) {
    console.error("Error in getCompletedAds:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while fetching completed ads",
    });
  }
};

module.exports = {
  getCompletedAds,
  adminApproveAdsProof,
  adminRejectAdsProof,
  getFinalCompletedAds,
};
