const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");
const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const User = require("../../../models/userModel/userModel");

/**
 * Get comprehensive free ads (reward ads) dashboard statistics for reporter
 * This endpoint reads directly from the database and provides all stats
 * for the /reporter/freeads dashboard page
 */
const getFreeAdCounts = async (req, res) => {
  try {
    const reporterId = req.user._id.toString(); // ✅ Compare as string
    const userId = req.user._id;

    // Get user details for verification check
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is verified
    const isVerified = user.role === 'Reporter' ? user.verifiedReporter : user.verifiedInfluencer;
    if (!isVerified) {
      return res.status(403).json({
        success: false,
        message: "You are not verified. Please apply for your ID card first.",
      });
    }

    const reporterState = req.user.state || "";
    const reporterCity = req.user.city || "";
    const userRole = req.user.role;

    // --- 1. COMPLETED ---
    // Count from FreeAdProof where status is "completed"
    const completedCount = await FreeAdProof.countDocuments({
      reporterId: userId,
      status: "completed",
    });

    // --- 2. RUNNING ---
    // Count from FreeAdProof where status is "submitted" (proof submitted but not yet completed)
    const runningCount = await FreeAdProof.countDocuments({
      reporterId: userId,
      status: "submitted",
    });

    // --- 3. ACCEPTED ---
    // Count ads where reporter has accepted but not yet submitted proof
    // This means: postStatus is "accepted" and adProof is not set/empty/null
    const acceptedCount = await freeAdModel.countDocuments({
      acceptedReporters: {
        $elemMatch: {
          reporterId: userId,
          postStatus: "accepted",
          $or: [
            { adProof: { $exists: false } },
            { adProof: "" },
            { adProof: null },
          ],
        },
      },
      // Only show ads for reporter role
      userType: { $in: ["reporter", "both"] },
    });

    // --- 4. AVAILABLE (NEW) ---
    // Ads that are available for the reporter to accept
    // This should match the same logic as getFreeAds.js
    const allApprovedAds = await freeAdModel.find({ 
      status: "approved",
      userType: { $in: ["reporter", "both"] } // Only reporter or both
    });

    const availableAds = allApprovedAds.filter(ad => {
      // ✅ Check if reporter already responded to this ad
      const reporterEntry = ad.acceptedReporters?.find(
        r => r.reporterId.toString() === reporterId
      );
      
      // Skip if reporter already responded (accepted, submitted, or completed)
      if (reporterEntry && reporterEntry.postStatus && reporterEntry.postStatus !== "pending") {
        return false;
      }

      // ✅ CRITICAL: Only show ads where reporter is explicitly targeted
      // Check if reporter is in the reportersIds array (this means they were specifically sent this ad)
      if (Array.isArray(ad.reportersIds) && ad.reportersIds.length > 0) {
        const isSpeciallySelected = ad.reportersIds.some(id => id.toString() === reporterId);
        if (isSpeciallySelected) {
          return true;
        }
      }

      // ✅ Show "all states" ads if reporter is verified
      if (ad.allState === true) {
        return true;
      }

      // ✅ Also check selectedReporters array (legacy support)
      if (Array.isArray(ad.selectedReporters) && ad.selectedReporters.some(id =>
        id.toString() === reporterId
      )) {
        return true;
      }

      // Don't show ads that don't match any criteria
      return false;
    });

    // --- 5. REJECTED (Optional - not shown in dashboard but included for completeness) ---
    const rejectedCount = await FreeAdProof.countDocuments({
      reporterId: userId,
      status: "rejected",
    });

    // Return comprehensive stats
    res.status(200).json({
      success: true,
      message: "Free ads (reward ads) statistics fetched successfully",
      data: {
        available: availableAds.length,  // New Reward Ads
        accepted: acceptedCount,          // Accepted Reward Ads
        running: runningCount,            // Running Reward Ads
        completed: completedCount,        // Completed Advertisement
        rejected: rejectedCount,          // Rejected (for reference)
        total: availableAds.length + acceptedCount + runningCount + completedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching free ads counts:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching free ads counts",
      error: error.message,
    });
  }
};

module.exports = getFreeAdCounts;

