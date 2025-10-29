const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");

const advertiserGetCompletedAds = async (req, res) => {
  const owner = req.user._id;

  try {
    console.log(`📊 Fetching completed ads for advertiser: ${owner}`);

    // Step 1: Get all completed ads posted by this owner
    const completedAds = await Adpost.find({ 
      owner,
      status: "completed"
    });

    console.log(`📊 Found ${completedAds.length} completed ads`);

    if (!completedAds || completedAds.length === 0) {
      return res.status(200).json({
        completedProofs: [],
        totalCount: 0,
        message: "No completed advertisements found for this advertiser.",
      });
    }

    // Step 2: Extract all completed ad IDs
    const adIds = completedAds.map((ad) => ad._id);

    // Step 3: Get all reporter proofs for these completed ads
    const allProofs = await reporterAdProof.find({
      adId: { $in: adIds }
    }).populate('proofs.reporterId', 'name email iinsafId');

    console.log(`📋 Found ${allProofs.length} proof documents for completed ads`);

    // Step 4: Create enhanced response with ad details and associated proofs
    const enhancedAds = completedAds.map(ad => {
      // Find all proofs for this ad
      const adProofDoc = allProofs.find(proofDoc => 
        proofDoc.adId.toString() === ad._id.toString()
      );

      // Extract individual reporter proofs that are completed
      const reporterProofs = adProofDoc && adProofDoc.proofs 
        ? adProofDoc.proofs.filter(proof => 
            proof.status === "completed" && proof.adminApprovedAt
          ).map(proof => ({
            reporterId: proof.reporterId?._id,
            iinsafId: proof.reporterId?.iinsafId || 'N/A',
            reporterName: proof.reporterId?.name || 'N/A',
            reporterEmail: proof.reporterId?.email || 'N/A',
            platform: proof.platform,
            channelName: proof.channelName,
            videoLink: proof.videoLink,
            duration: proof.duration,
            submittedAt: proof.submittedAt,
            completionSubmittedAt: proof.completionSubmittedAt,
            adminApprovedAt: proof.adminApprovedAt,
            status: proof.status,
            completedTaskScreenshot: proof.completedTaskScreenshot
          }))
        : [];

      return {
        _id: ad._id,
        adId: ad._id,
        adType: ad.adType,
        mediaType: ad.mediaType,
        mediaDescription: ad.mediaDescription,
        userType: ad.userType,
        requiredViews: ad.requiredViews,
        adLength: ad.adLength,
        totalCost: ad.totalCost,
        subtotal: ad.subtotal,
        gst: ad.gst,
        finalReporterPrice: ad.finalReporterPrice,
        startDate: ad.startDate,
        endDate: ad.endDate,
        pfState: ad.pfState,
        pfCities: ad.pfCities,
        createdAt: ad.createdAt,
        approvedAt: ad.approvedAt,
        completedAt: ad.completedAt,
        imageUrl: ad.imageUrl,
        videoUrl: ad.videoUrl,
        requiredReporter: ad.requiredReporter,
        allStates: ad.allStates,
        adminSelectState: ad.adminSelectState,
        adminSelectCities: ad.adminSelectCities,
        adminSelectPincode: ad.adminSelectPincode,
        status: ad.status,
        updatedAt: ad.updatedAt,
        completionDetails: ad.completionDetails,
        // Add reporter proofs
        proofs: reporterProofs,
        totalProofs: reporterProofs.length,
        // Add refund information if available
        refundInfo: ad.completionDetails ? {
          refundProcessed: ad.completionDetails.refundProcessed || false,
          totalRefundAmount: ad.completionDetails.totalRefundAmount || 0,
          refundedReporters: ad.completionDetails.refundedReporters || 0,
          completedReporters: ad.completionDetails.completedReporters || 0,
          rejectedReporters: ad.completionDetails.rejectedReporters || 0
        } : null
      };
    });

    console.log(`✅ Enhanced ${enhancedAds.length} completed advertisements with proofs`);

    return res.status(200).json({ 
      completedProofs: enhancedAds,
      totalCount: enhancedAds.length,
      message: "Completed advertisements with detailed information fetched successfully"
    });
  } catch (error) {
    console.error("❌ Error fetching completed ad proofs:", error);
    return res.status(500).json({ 
      message: "Server error while fetching completed advertisements.",
      error: error.message 
    });
  }
};

module.exports = advertiserGetCompletedAds;