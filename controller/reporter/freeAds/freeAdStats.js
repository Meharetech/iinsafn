const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");
const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");

const getFreeAdCounts = async (req, res) => {
  try {
    const reporterId = req.user._id.toString(); // ✅ Compare as string
    const reporterState = req.user.state || "";
    const reporterCity = req.user.city || "";

    // --- Rejected ---
    const rejectedCount = await FreeAdProof.countDocuments({
      reporterId,
      status: "rejected",
    });

    // --- Completed ---
    const completedCount = await FreeAdProof.countDocuments({
      reporterId,
      status: "completed",
    });

    // --- Running ---
    const runningCount = await FreeAdProof.countDocuments({
      reporterId,
      status: "submitted",
    });

    // --- Accepted ---
    const acceptedCount = await freeAdModel.countDocuments({
      acceptedReporters: {
        $elemMatch: {
          reporterId: req.user._id,
          postStatus: "accepted",
          $or: [
            { adProof: { $exists: false } },
            { adProof: "" },
            { adProof: null },
          ],
        },
      },
    });

    // --- Available ---
    const allAds = await freeAdModel.find({ status: "approved" });

    const availableAds = allAds.filter(ad => {
      // Skip if reporter already accepted
      const alreadyAccepted = ad.acceptedReporters?.some(r =>
        r.reporterId.toString() === reporterId
      );
      if (alreadyAccepted) return false;

      // All states
      if (ad.allState) return true;

      // Selected reporters
      if (Array.isArray(ad.selectedReporters) && ad.selectedReporters.some(id =>
        id.toString() === reporterId
      )) return true;

      // State/City match
      if ((Array.isArray(ad.state) && ad.state.includes(reporterState)) ||
          (Array.isArray(ad.city) && ad.city.includes(reporterCity))) return true;

      return false;
    });

    res.status(200).json({
      success: true,
      message: "Free ads statistics fetched successfully",
      data: {
        rejected: rejectedCount,
        completed: completedCount,
        running: runningCount,
        accepted: acceptedCount,
        available: availableAds.length,
        total: rejectedCount + completedCount + runningCount + acceptedCount + availableAds.length,
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

