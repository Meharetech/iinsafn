const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");
const User = require("../../../models/userModel/userModel");

const getInfluencerAcceptedFreeAds = async (req, res) => {
  try {
    const influencerId = req.user._id;

    console.log(`🔍 Fetching accepted free ads for influencer: ${influencerId}`);

    // Step 1: Fetch user info
    const user = await User.findById(influencerId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Step 2: Check verification - influencers must be verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "You are not a verified influencer. Please apply for your ID card first.",
      });
    }

    // Step 3: Ensure user is actually an influencer
    if (user.role !== "Influencer") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for influencers only.",
      });
    }

    // Step 4: Fetch all ads where the influencer has accepted but not submitted proof
    const matchedAds = await freeAdModel.find({
      acceptedReporters: {
        $elemMatch: {
          reporterId: influencerId,
          postStatus: "accepted",
          $or: [
            { adProof: { $exists: false } }, // adProof not set
            { adProof: "" }, // adProof is empty string
            { adProof: null }, // adProof is null
            { adProof: false } // explicitly false
          ]
        }
      },
      // Only show ads that are meant for influencers
      userType: { $in: ["influencer", "both"] }
    });

    console.log(`🔍 Found ${matchedAds.length} accepted free ads for influencer ${influencerId}`);

    // ✅ Enhanced response with rejection information
    const enhancedAds = matchedAds.map(ad => {
      const influencerEntry = ad.acceptedReporters.find(r => r.reporterId.toString() === influencerId.toString());
      return {
        ...ad.toObject(),
        influencerEntry: {
          postStatus: influencerEntry?.postStatus,
          acceptedAt: influencerEntry?.acceptedAt,
          submittedAt: influencerEntry?.submittedAt,
          completedAt: influencerEntry?.completedAt,
          adProof: influencerEntry?.adProof,
          rejectNote: influencerEntry?.rejectNote,
          rejectedAt: influencerEntry?.rejectedAt,
          adminRejectNote: influencerEntry?.adminRejectNote,
          iinsafId: influencerEntry?.iinsafId
        }
      };
    });

    res.status(200).json({
      success: true,
      message: "Influencer accepted free ads fetched successfully",
      data: enhancedAds,
      totalCount: enhancedAds.length,
      influencerInfo: {
        name: user.name,
        state: user.state,
        city: user.city,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error("Error fetching influencer accepted free ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching influencer accepted free ads",
      error: error.message
    });
  }
};

const influencerGetFreeRunningAds = async (req, res) => {
  try {
    const influencerId = req.user._id;

    console.log(`🔍 Fetching running free ads for influencer: ${influencerId}`);

    // Step 1: Find proofs where influencer submitted but ad is running
    const proofs = await FreeAdProof.find({
      reporterId: influencerId,
      status: "submitted" // proof status
    });

    // Step 2: Keep only proofs with populated ad details
    const runningAds = proofs.filter(p => p.adId);

    console.log(`🔍 Found ${runningAds.length} running free ads for influencer ${influencerId}`);

    res.status(200).json({
      success: true,
      message: "Influencer running free ads fetched successfully",
      data: runningAds,
      totalCount: runningAds.length
    });
  } catch (error) {
    console.error("Error fetching running free ads for influencer:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching running free ads for influencer",
      error: error.message
    });
  }
};

module.exports = { getInfluencerAcceptedFreeAds, influencerGetFreeRunningAds };
