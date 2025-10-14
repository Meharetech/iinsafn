const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const mongoose = require('mongoose');

const acceptInfluencerFreeAd = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const iinsafId = req.user.iinsafId;
    const adId = req.params.adId;

    console.log("=== ACCEPT INFLUENCER FREE AD DEBUG ===");
    console.log("User ID:", userId);
    console.log("User Role:", userRole);
    console.log("User iinsafId:", iinsafId);
    console.log("Ad ID:", adId);

    // Validate user is an influencer
    if (userRole !== "Influencer") {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for influencers only."
      });
    }

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
    console.log("Ad influencersIds:", ad.influencersIds);
    console.log("Ad acceptedReporters:", ad.acceptedReporters);

    // ✅ Check if influencer is eligible for this ad
    let isEligible = false;
    
    // Check if ad is meant for influencers
    if (ad.userType === "influencer" || ad.userType === "both") {
      // Check if influencer is specifically selected
      if (Array.isArray(ad.influencersIds) && ad.influencersIds.length > 0) {
        isEligible = ad.influencersIds.includes(userId.toString());
      }
      
      // Check if ad is for all states
      if (ad.allState === true) {
        isEligible = true;
      }
      
      // Check location targeting
      if (!isEligible && req.user.state && Array.isArray(ad.state)) {
        isEligible = ad.state.includes(req.user.state);
      }
      
      if (!isEligible && req.user.city && Array.isArray(ad.city)) {
        isEligible = ad.city.includes(req.user.city);
      }
    }

    console.log("Influencer eligible:", isEligible);

    if (!isEligible) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "You are not eligible for this advertisement",
      });
    }

    // ✅ Check if influencer already exists in acceptedReporters
    const existingEntry = ad.acceptedReporters.find(
      entry => entry.reporterId.toString() === userId.toString()
    );

    if (existingEntry) {
      if (existingEntry.postStatus === "accepted") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "You have already accepted this free ad",
        });
      } else if (existingEntry.postStatus === "rejected") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "You have already rejected this free ad",
        });
      } else if (existingEntry.postStatus === "submitted") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "You have already submitted proof for this free ad",
        });
      } else if (existingEntry.postStatus === "completed") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "This free ad is already completed",
        });
      } else {
        // Status is "pending" - update existing entry
        existingEntry.postStatus = "accepted";
        existingEntry.acceptedAt = new Date();
        existingEntry.userRole = "Influencer";
        console.log("Updated existing pending entry to accepted");
      }
    } else {
      // Create new entry
      ad.acceptedReporters.push({
        reporterId: userId,
        iinsafId: iinsafId,
        postStatus: "accepted",
        acceptedAt: new Date(),
        userRole: "Influencer",
        adProof: false
      });
      console.log("Created new accepted entry");
    }

    // Save the ad
    await ad.save({ session });

    // Check if all required influencers have accepted
    const totalRequired = ad.influencersIds?.length || 0;
    const acceptedCount = ad.acceptedReporters.filter(
      entry => entry.postStatus === "accepted" && entry.userRole === "Influencer"
    ).length;

    console.log(`Total required influencers: ${totalRequired}, Accepted: ${acceptedCount}`);

    // If all required influencers have accepted, update ad status to "running"
    if (totalRequired > 0 && acceptedCount >= totalRequired) {
      ad.status = "running";
      await ad.save({ session });
      console.log("Ad status updated to 'running'");
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Free ad accepted successfully",
      data: {
        adId: ad._id,
        status: ad.status,
        acceptedAt: new Date(),
        totalRequired,
        acceptedCount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error accepting influencer free ad:", error);
    res.status(500).json({
      success: false,
      message: "Server error while accepting free ad",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = acceptInfluencerFreeAd;
