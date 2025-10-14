const Adpost = require("../../models/advertismentPost/advertisementPost");
const AdPricing = require("../../models/adminModels/advertismentPriceSet/adPricingSchema");
const mongoose = require("mongoose"); // ✅ Add mongoose for transactions

const acceptAd = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log("🔍 Accept Ad Debug - Request received");
    console.log("🔍 Accept Ad Debug - User ID:", req.user._id);
    console.log("🔍 Accept Ad Debug - User iinsafId:", req.user.iinsafId);
    console.log("🔍 Accept Ad Debug - Ad ID:", req.params.adId);
    
    const userId = req.user._id;
    const userIinsafId = req.user.iinsafId;
    const adId = req.params.adId;

    if (!adId) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "adId is required" });
    }

    const ad = await Adpost.findById(adId).session(session);
    if (!ad) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    const pricing = await AdPricing.findOne();
    const acceptTimeInHours = pricing?.reporterAcceptTimeInHours || 1;

    const approvedAt = new Date(ad.approvedAt);
    const expiryTime = new Date(
      approvedAt.getTime() + acceptTimeInHours * 60 * 60 * 1000
    );
    const now = new Date();

    const userEntryIndex = ad.acceptRejectReporterList.findIndex(
      (r) => r.reporterId && r.reporterId.toString() === userId.toString()
    );
    const userEntry = ad.acceptRejectReporterList[userEntryIndex];

    // ✅ If ad has already expired
    if (now >= expiryTime) {
      if (!userEntry) {
        // Add auto-rejection entry
        ad.acceptRejectReporterList.push({
          reporterId: userId,
          iinsafId: userIinsafId,
          postStatus: "rejected",
          accepted: false,
          adProof: false,
          rejectNote: "Auto-rejected due to expiry of time",
          rejectedAt: new Date(),
          userRole: req.user.role === "influencer" ? "Influencer" : "Reporter",
        });
        await ad.save({ session });
      } else if (userEntry.postStatus !== "accepted") {
        // Update existing entry if not accepted
        ad.acceptRejectReporterList[userEntryIndex] = {
          ...userEntry,
          reporterId: userId, // ✅ Ensure reporterId is preserved
          iinsafId: userIinsafId,
          postStatus: "rejected",
          accepted: false,
          adProof: false,
          rejectNote: "Auto-rejected due to expiry of time",
          rejectedAt: new Date(),
          userRole: req.user.role === "influencer" ? "Influencer" : "Reporter",
        };
        await ad.save({ session });
      }

      await session.commitTransaction();
      return res.status(403).json({
        success: false,
        message: "Ad acceptance time has expired.",
      });
    }

    // ✅ Already accepted
    if (userEntry?.postStatus === "accepted") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "You have already accepted this ad.",
      });
    }

    // ✅ Already rejected (don't let retry)
    if (userEntry?.postStatus === "rejected") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "You have already been rejected for this ad.",
      });
    }

    // ✅ If ad already filled
    if (ad.acceptReporterCount >= ad.requiredReporter) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "This ad has already reached the required number of reporters",
      });
    }

    // ✅ Accept the ad now
    if (userEntry) {
      // Update existing entry
      ad.acceptRejectReporterList[userEntryIndex] = {
        ...userEntry,
        reporterId: userId, // ✅ Ensure reporterId is preserved
        iinsafId: userIinsafId,
        postStatus: "accepted",
        accepted: true,
        adProof: false,
        acceptedAt: now,
        userRole: req.user.role === "influencer" ? "Influencer" : "Reporter",
      };
      console.log("🔍 Accept Ad Debug - Updated existing entry");
    } else {
      // Add new entry
      const newEntry = {
        reporterId: userId,
        iinsafId: userIinsafId,
        postStatus: "accepted",
        accepted: true,
        adProof: false,
        acceptedAt: now,
        userRole: req.user.role === "influencer" ? "Influencer" : "Reporter",
      };
      
      console.log("🔍 Accept Ad Debug - Adding new entry:", newEntry);
      ad.acceptRejectReporterList.push(newEntry);
    }

    ad.acceptReporterCount += 1;
    console.log("🔍 Accept Ad Debug - Updated acceptReporterCount:", ad.acceptReporterCount);

    // ✅ If ad is now full, update status to running
    if (
      ad.acceptReporterCount === ad.requiredReporter &&
      ad.status === "approved"
    ) {
      ad.status = "running";
      console.log("🔍 Accept Ad Debug - Ad status changed to running");
    }

    await ad.save({ session });
    await session.commitTransaction();
    console.log("🔍 Accept Ad Debug - Ad saved successfully");

    return res.status(200).json({
      success: true,
      message: "Ad accepted successfully",
      data: ad,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in acceptAd:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
};

const rejectAd = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log("🔍 Reject Ad Debug - Request received");
    console.log("🔍 Reject Ad Debug - User ID:", req.user._id);
    console.log("🔍 Reject Ad Debug - User iinsafId:", req.user.iinsafId);
    console.log("🔍 Reject Ad Debug - Ad ID:", req.params.adId);
    
    const userId = req.user._id;
    const adId = req.params.adId;
    const userIinsafId = req.user.iinsafId;
    const { note } = req.body; // note = rejection reason

    console.log("🔍 Reject Ad Debug - userId:", userId);
    console.log("🔍 Reject Ad Debug - userId type:", typeof userId);

    if (!note || note.trim() === "") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Rejection note is required" });
    }

    if (!adId) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "adId is required" });
    }

    const ad = await Adpost.findById(adId).session(session);
    if (!ad) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    console.log("🔍 Reject Ad Debug - Ad found:", ad._id);
    console.log("🔍 Reject Ad Debug - acceptRejectReporterList:", ad.acceptRejectReporterList);
    console.log("🔍 Reject Ad Debug - acceptRejectReporterList length:", ad.acceptRejectReporterList?.length);

    // Check if user already has an entry in the list
    const userEntryIndex = ad.acceptRejectReporterList.findIndex(
      (r) => {
        console.log("🔍 Reject Ad Debug - Checking entry:", r);
        console.log("🔍 Reject Ad Debug - r.reporterId:", r.reporterId);
        console.log("🔍 Reject Ad Debug - r.reporterId type:", typeof r.reporterId);
        return r.reporterId && r.reporterId.toString() === userId.toString();
      }
    );
    const userEntry = ad.acceptRejectReporterList[userEntryIndex];

    // If user already has an entry, update it
    if (userEntry) {
      // Check if already rejected
      if (userEntry.postStatus === "rejected") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "You have already rejected this ad.",
        });
      }

      // Check if already accepted
      if (userEntry.postStatus === "accepted") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "You have already accepted this ad. Cannot reject now.",
        });
      }

      // Update existing entry
      ad.acceptRejectReporterList[userEntryIndex] = {
        ...userEntry,
        reporterId: userId, // ✅ Ensure reporterId is preserved
        iinsafId: userIinsafId,
        postStatus: "rejected",
        accepted: false,
        adProof: false,
        rejectNote: note,
        rejectedAt: new Date(),
        userRole: req.user.role === "influencer" ? "Influencer" : "Reporter",
      };
    } else {
      // Add new rejection entry
      const newEntry = {
        reporterId: userId,
        iinsafId: userIinsafId,
        postStatus: "rejected",
        accepted: false,
        adProof: false,
        rejectNote: note,
        rejectedAt: new Date(),
        userRole: req.user.role === "influencer" ? "Influencer" : "Reporter",
      };
      
      console.log("🔍 Reject Ad Debug - Adding new rejection entry:", newEntry);
      ad.acceptRejectReporterList.push(newEntry);
    }

    await ad.save({ session });
    await session.commitTransaction();
    console.log("🔍 Reject Ad Debug - Ad saved successfully");

    return res.status(200).json({
      success: true,
      message: "Ad rejected and note saved",
      updatedAd: ad,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Error in reporterRejectAd:", err);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
};
module.exports = { acceptAd, rejectAd };
