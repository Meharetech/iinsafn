const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");
const User = require("../../models/userModel/userModel");

/**
 * Get comprehensive advertisement dashboard statistics for reporter
 * This endpoint reads directly from the database and provides all stats
 * for the /reporter/advertisement dashboard page
 */
const getReporterAdvertisementDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Get user details and check if verified
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is verified (works for both reporter and influencer)
    const isVerified = user.role === 'Reporter' ? user.verifiedReporter : user.verifiedInfluencer;
    if (!isVerified) {
      return res.status(403).json({
        success: false,
        message: "You are not verified. Please apply for your ID card first.",
      });
    }

    const { state: userState, city: userCity, role } = user;
    const userRole = role === "Influencer" ? "influencer" : "reporter";

    // 2. Fetch all approved/modified ads for the user's role
    const allApprovedAds = await Adpost.find({ 
      status: { $in: ["approved", "modified"] },
      userType: userRole
    });

    // 3. PENDING (New) Ads - Ads that are available for the reporter to accept
    // These are ads where:
    // - Reporter is in the notification list (acceptRejectReporterList)
    // - Reporter's postStatus is "pending"
    // - Ad is not yet fulfilled
    const pendingAds = allApprovedAds.filter((ad) => {
      // Check if ad is already fulfilled
      if (
        typeof ad.requiredReporter === "number" &&
        typeof ad.acceptReporterCount === "number" &&
        ad.acceptReporterCount >= ad.requiredReporter
      ) {
        return false;
      }

      // Check if reporter is in the notification list
      const reporterEntry = ad.acceptRejectReporterList?.find(
        (entry) => entry.reporterId?.toString() === userId.toString()
      );

      // If reporter is not in the list, don't show the ad
      if (!reporterEntry) {
        return false;
      }

      // If reporter has already responded (not pending), don't show
      if (reporterEntry.postStatus && reporterEntry.postStatus !== "pending") {
        return false;
      }

      // Show only if postStatus is "pending" or not set
      return true;
    });

    const pendingCount = pendingAds.length;

    // 4. ACCEPTED Ads - Ads that reporter has accepted but not yet submitted proof
    const acceptedCount = await Adpost.countDocuments({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          accepted: true,
          postStatus: "accepted",
          $or: [
            { adProof: { $exists: false } },
            { adProof: false },
          ],
        },
      },
      userType: userRole
    });

    // 5. REJECTED Ads - Ads that reporter has rejected
    const rejectedCount = await Adpost.countDocuments({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          accepted: false,
          postStatus: "rejected",
        },
      },
      userType: userRole
    });

    // 6. RUNNING Ads - Ads where proof has been submitted but not yet completed
    // Running ads are those with status: "pending", "approved", "submitted", or "rejected"
    // (basically any status except "completed")
    const runningProofs = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          reporterId: userId,
          status: { $in: ["pending", "approved", "submitted", "rejected"] },
        },
      },
    });

    // Count unique ads (one ad can have multiple proofs)
    const runningAdIds = new Set();
    runningProofs.forEach(proofDoc => {
      proofDoc.proofs.forEach(proof => {
        if (proof.reporterId.toString() === userId.toString() && 
            ["pending", "approved", "submitted", "rejected"].includes(proof.status)) {
          runningAdIds.add(proofDoc.adId.toString());
        }
      });
    });

    // Also count from acceptRejectReporterList where postStatus indicates proof submitted
    const runningFromAdpost = await Adpost.find({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          postStatus: { $in: ["submitted", "proof_submitted"] },
        },
      },
      userType: userRole
    });

    runningFromAdpost.forEach(ad => {
      runningAdIds.add(ad._id.toString());
    });

    const finalRunningCount = runningAdIds.size;

    // 7. COMPLETED Ads - Ads that have been completed
    // Count from reporterAdProof where status is "completed"
    const completedProofs = await reporterAdProof.find({
      "proofs.reporterId": userId,
      "proofs.status": "completed"
    });

    // Count unique ads
    const completedAdIds = new Set();
    completedProofs.forEach(proofDoc => {
      proofDoc.proofs.forEach(proof => {
        if (proof.reporterId.toString() === userId.toString() && proof.status === "completed") {
          completedAdIds.add(proofDoc.adId.toString());
        }
      });
    });

    // Alternative: Count from acceptRejectReporterList where postStatus is "completed"
    const completedFromAdpost = await Adpost.find({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          postStatus: "completed",
        },
      },
      userType: userRole
    });

    completedFromAdpost.forEach(ad => {
      completedAdIds.add(ad._id.toString());
    });

    const finalCompletedCount = completedAdIds.size;

    // 8. Return comprehensive stats
    res.status(200).json({
      success: true,
      message: `${role} advertisement dashboard stats fetched successfully`,
      data: {
        pending: pendingCount,
        accepted: acceptedCount,
        rejected: rejectedCount,
        running: finalRunningCount,
        completed: finalCompletedCount,
        total: pendingCount + acceptedCount + rejectedCount + finalRunningCount + finalCompletedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching reporter advertisement dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching advertisement dashboard stats",
      error: error.message,
    });
  }
};

module.exports = getReporterAdvertisementDashboardStats;

