const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");
const User = require("../../../models/userModel/userModel");

const getFreeCompletedAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    console.log(`🔍 Fetching completed free ads for reporter: ${reporterId}`);

    // Step 1: Fetch user info
    const user = await User.findById(reporterId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Step 2: Check verification - reporters must be verified
    if (!user.verifiedReporter) {
      return res.status(403).json({
        success: false,
        message: "You are not a verified reporter. Please apply for your ID card first.",
      });
    }

    // Step 3: Ensure user is actually a reporter
    if (user.role !== "Reporter") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for reporters only.",
      });
    }

    // ✅ Fetch only completed ads for this reporter with enhanced details
    const completedAds = await FreeAdProof.find({
      reporterId,
      status: "completed"
    }).populate("adId");

    if (!completedAds || completedAds.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No completed free ads found",
        data: [],
        totalCount: 0
      });
    }

    // ✅ Enhanced response with complete proof details
    const enhancedAds = completedAds.map(proof => ({
      _id: proof._id,
      adId: proof.adId,
      reporterId: proof.reporterId,
      iinsafId: proof.iinsafId,
      status: proof.status,
      submittedAt: proof.submittedAt,
      
      // ✅ Complete work submitted details
      proofDetails: {
        screenshot: proof.screenshot,
        videoLink: proof.videoLink,
        channelName: proof.channelName,
        platform: proof.platform,
        duration: proof.duration,
        submittedAt: proof.submittedAt,
        adminRejectNote: proof.adminRejectNote,
        status: proof.status
      },
      
      // ✅ Ad details
      adDetails: proof.adId ? {
        _id: proof.adId._id,
        adType: proof.adId.adType,
        mediaType: proof.adId.mediaType,
        imageUrl: proof.adId.imageUrl,
        videoUrl: proof.adId.videoUrl,
        description: proof.adId.description,
        state: proof.adId.state,
        city: proof.adId.city,
        allState: proof.adId.allState,
        userType: proof.adId.userType,
        status: proof.adId.status,
        createdAt: proof.adId.createdAt,
        updatedAt: proof.adId.updatedAt
      } : null,
      
      // ✅ Reporter info
      reporterInfo: {
        name: user.name,
        state: user.state,
        city: user.city,
        verifiedReporter: user.verifiedReporter,
        role: user.role
      }
    }));

    console.log(`🔍 Found ${enhancedAds.length} completed free ads for reporter ${reporterId}`);

    res.status(200).json({
      success: true,
      message: "Reporter completed free ads fetched successfully",
      data: enhancedAds,
      totalCount: enhancedAds.length,
      reporterInfo: {
        name: user.name,
        state: user.state,
        city: user.city,
        verifiedReporter: user.verifiedReporter
      }
    });

  } catch (error) {
    console.error("Error fetching reporter completed free ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reporter completed free ads",
      error: error.message
    });
  }
};

module.exports = getFreeCompletedAds;
