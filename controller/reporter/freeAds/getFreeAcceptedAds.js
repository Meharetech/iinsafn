const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema")


const getFreeAcceptedAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Fetch all ads where the reporter has accepted but not submitted proof
    const matchedAds = await freeAdModel.find({
      acceptedReporters: {
        $elemMatch: {
          reporterId: reporterId,
          postStatus: "accepted",
          $or: [
            { adProof: { $exists: false } }, // adProof not set
            { adProof: "" }, // adProof is empty string
            { adProof: null }, // adProof is null
            { adProof: false } // explicitly false
          ]
        }
      }
    });

    // ✅ Enhanced response with rejection information
    const enhancedAds = matchedAds.map(ad => {
      const reporterEntry = ad.acceptedReporters.find(r => r.reporterId.toString() === reporterId.toString());
      return {
        ...ad.toObject(),
        reporterEntry: {
          postStatus: reporterEntry?.postStatus,
          acceptedAt: reporterEntry?.acceptedAt,
          submittedAt: reporterEntry?.submittedAt,
          completedAt: reporterEntry?.completedAt,
          adProof: reporterEntry?.adProof,
          rejectNote: reporterEntry?.rejectNote,
          rejectedAt: reporterEntry?.rejectedAt,
          adminRejectNote: reporterEntry?.adminRejectNote,
          iinsafId: reporterEntry?.iinsafId
        }
      };
    });

    res.status(200).json({
      success: true,
      message: "Free ads fetched where reporter has accepted but not yet submitted ad proof",
      data: enhancedAds,
      totalCount: enhancedAds.length
    });

  } catch (error) {
    console.error("Error fetching free accepted ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching free accepted ads",
      error: error.message
    });
  }
};


const reporterGetFreeRunningAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Step 1: Find proofs where reporter submitted but ad is running
    const proofs = await FreeAdProof.find({
      reporterId,
      status: "submitted" // proof status
    })

    // Step 2: Keep only proofs with populated ad details
    const runningAds = proofs.filter(p => p.adId);

    res.status(200).json({
      success: true,
      message: "Free running ads fetched successfully for reporter",
      data: runningAds
    });
  } catch (error) {
    console.error("Error fetching running free ads for reporter:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching running free ads"
    });
  }
};


module.exports = {getFreeAcceptedAds,reporterGetFreeRunningAds}
