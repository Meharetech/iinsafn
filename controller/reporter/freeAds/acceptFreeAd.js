const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const mongoose = require('mongoose');

const acceptFreeAd = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const iinsafId = req.user.iinsafId;
    const adId = req.params.adId;

    console.log("=== ACCEPT FREE AD DEBUG ===");
    console.log("User ID:", userId);
    console.log("User Role:", userRole);
    console.log("User iinsafId:", iinsafId);
    console.log("Ad ID:", adId);

    if (!adId) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Ad ID is required" });
    }

    // Use session for consistent reads
    const ad = await freeAdModel.findById(adId).session(session);
    if (!ad) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Free ad not found" });
    }

    console.log("Ad found:", ad._id);
    console.log("Ad userType:", ad.userType);
    console.log("Ad reportersIds:", ad.reportersIds);
    console.log("Ad influencersIds:", ad.influencersIds);
    console.log("Ad acceptedReporters:", ad.acceptedReporters);
    console.log("Ad acceptedReporters length:", ad.acceptedReporters?.length || 0);

    // ✅ Check if user is eligible for this ad
    let isEligible = false;
    if (userRole === "Reporter" && (ad.userType === "reporter" || ad.userType === "both")) {
      isEligible = ad.reportersIds.includes(userId.toString()) || ad.allState;
    } else if (userRole === "Influencer" && (ad.userType === "influencer" || ad.userType === "both")) {
      isEligible = ad.influencersIds.includes(userId.toString()) || ad.allState;
    }

    console.log("User eligible:", isEligible);

    if (!isEligible) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "You are not eligible for this free ad",
      });
    }

    // ✅ Check if already accepted (only check for non-pending status)
    const existingEntry = ad.acceptedReporters.find(
      (r) => r.reporterId.toString() === userId.toString()
    );
    
    console.log("Existing entry:", existingEntry);
    
    if (existingEntry) {
      console.log("Existing entry postStatus:", existingEntry.postStatus);
      
      // Only reject if status is not "pending"
      if (existingEntry.postStatus !== "pending") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "You have already accepted this free ad",
        });
      }
      
      // If status is "pending", update it to "accepted"
      existingEntry.postStatus = "accepted";
      existingEntry.acceptedAt = new Date();
      existingEntry.userRole = userRole;
      
      console.log("Updated existing entry to accepted");
    } else {
      // Add new entry to acceptedReporters
      ad.acceptedReporters.push({
        reporterId: userId,
        iinsafId: iinsafId,
        postStatus: "accepted",
        acceptedAt: new Date(),
        userRole: userRole,
      });
      
      console.log("Added new entry to acceptedReporters");
    }

    // ✅ Check if all required users have accepted
    const totalRequired = ad.requiredReportersCount || 0;
    const acceptedCount = ad.acceptedReporters?.filter(r => r.postStatus === 'accepted').length || 0;
    
    console.log("Total required:", totalRequired);
    console.log("Accepted count:", acceptedCount);
    
    if (totalRequired > 0 && acceptedCount === totalRequired) {
      ad.status = "running";
      console.log("Ad status updated to running");
    }

    // Save the updated ad
    await ad.save({ session });

    await session.commitTransaction();

    console.log("Free ad accepted successfully");

    return res.status(200).json({
      success: true,
      message: "Free ad accepted successfully",
      data: ad,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in acceptFreeAd:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while accepting free ad",
    });
  } finally {
    session.endSession();
  }
};

module.exports = acceptFreeAd;
