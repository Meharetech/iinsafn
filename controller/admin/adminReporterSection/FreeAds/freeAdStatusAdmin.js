const freeAdModel = require("../../../../models/adminModels/freeAds/freeAdsSchema");
const FreeAdProof = require("../../../../models/adminModels/freeAds/freeAdProofSchema");
const genrateIdCard = require("../../../../models/reporterIdGenrate/genrateIdCard");

const getPendingFreeAds = async (req, res) => {
  try {
    // Fetch all approved and modified ads
    const ads = await freeAdModel.find({ status: { $in: ["approved", "modified"] } });

    const pendingAds = [];

    for (let ad of ads) {
      const totalRequired = ad.requiredReportersCount || 0;
      const acceptedCount = ad.acceptedReporters?.filter((r) => r.postStatus === "accepted").length || 0;

      if (totalRequired > 0 && acceptedCount === totalRequired) {
        // ✅ Update overall status to "running"
        ad.status = "running";
        await ad.save();
      } else {
        // ✅ Include ad in pending list
        pendingAds.push(ad);
      }
    }

    res.status(200).json({ success: true, data: pendingAds });
  } catch (error) {
    console.error("Error fetching pending ads:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// 🟧 2. Get Approved Ads — All reporters that  accepte the ad
const getApprovedFreeAds = async (req, res) => {
  try {
    // Get ads where status is "running"
     const ads = await freeAdModel.find({
      status: { $in: ["approved", "running"] },
    }).lean();

    const finalAds = [];

    for (const ad of ads) {
      const acceptedReporters = ad.acceptedReporters || [];

      // Build reporter data for this ad
      const reporterDetails = await Promise.all(
        acceptedReporters.map(async (r) => {
          const idCard = await genrateIdCard
            .findOne({ reporter: r.reporterId })
            .select("iinsafId");

          return {
            iinsafId: idCard ? idCard.iinsafId : "N/A",
            postStatus: r.postStatus,
            acceptedAt: r.acceptedAt,
            adProof: r.adProof || false,
          };
        })
      );

      finalAds.push({
        adId: ad._id,
        adType: ad.adType,
        userType: ad.userType, // ✅ Added userType field
        state: ad.state || [],
        city: ad.city || [],
        description: ad.description,
        media: ad.mediaType === "image" ? ad.imageUrl : ad.videoUrl || null,
        requiredReportersCount: ad.requiredReportersCount || 0, // ✅ Added here
        acceptedReporters: reporterDetails,
      });
    }

    res.status(200).json({ success: true, data: finalAds });
  } catch (error) {
    console.error("Error fetching approved ads:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// 🟦 3. Get Running Ads — Ad is running + proofs uploaded
// const getRunningFreeAds = async (req, res) => {
//   try {
//     // ✅ Fetch ads with status approved or running (not completed)
//     const ads = await freeAdModel.find({
//       status: { $in: ["approved", "running"] },
//     }).lean();

//     const adsWithProofs = await Promise.all(
//       ads.map(async (ad) => {
//         // ✅ Get proofs for this ad (with iinsafId already stored)
//         const proofs = await FreeAdProof.find({ adId: ad._id })
//           .select("iinsafId reporterId platform channelName videoLink screenshot duration ")
//           .lean();

//         if (proofs.length === 0) return null;

//         // ✅ Format proofs with only required fields
//         const proofsWithIds = proofs.map((p) => ({
//           adId: ad._id,
//           requiredReporterCount: ad.requiredReportersCount, // ✅ from ad
//           reporterId: p.reporterId,
//           iinsafId: p.iinsafId, // ✅ directly from FreeAdProof
//           platform: p.platform,
//           channelName: p.channelName,
//           videoLink: p.videoLink,
//           screenshot: p.screenshot,
//           duration: p.duration,
//         }));

//         return proofsWithIds;
//       })
//     );

//     // ✅ Flatten and filter nulls
//     const runningAds = adsWithProofs.flat().filter(Boolean);

//     res.status(200).json({ success: true, data: runningAds });
//   } catch (error) {
//     console.error("Error fetching running ads:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };




// 🟧 Get Running Free Ads — fetch from FreeAdProof where status = "submitted"
const getRunningFreeAds = async (req, res) => {
  try {
    // ✅ Fetch proofs that are submitted (reporter uploaded)
    const proofs = await FreeAdProof.find({ status: "submitted" })
      .select("adId reporterId iinsafId platform channelName videoLink screenshot duration")
      .lean();

    if (!proofs || proofs.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // ✅ Fetch related ad details in one go
    const adIds = [...new Set(proofs.map((p) => p.adId.toString()))];
    const ads = await freeAdModel.find({ _id: { $in: adIds } })
      .select("requiredReportersCount adType state city description mediaType imageUrl videoUrl")
      .lean();

    const adMap = ads.reduce((acc, ad) => {
      acc[ad._id] = ad;
      return acc;
    }, {});

    // ✅ Merge proofs with ad details
    const runningAds = proofs.map((p) => {
      const ad = adMap[p.adId];
      return {
        adId: p.adId,
        adType: ad?.adType || null,
        userType: ad?.userType, // ✅ Added userType field
        state: ad?.state || [],
        city: ad?.city || [],
        description: ad?.description || "",
        media: ad?.mediaType === "image" ? ad?.imageUrl : ad?.videoUrl || null,
        requiredReportersCount: ad?.requiredReportersCount || 0,
        reporterId: p.reporterId,
        iinsafId: p.iinsafId,
        platform: p.platform,
        channelName: p.channelName,
        videoLink: p.videoLink,
        screenshot: p.screenshot,
        duration: p.duration,
      };
    });

    res.status(200).json({ success: true, data: runningAds });
  } catch (error) {
    console.error("Error fetching running ads:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};









const getCompletedFreeAds = async (req, res) => {
  try {
    console.log("🔍 Fetching completed free ads...");

    // ✅ Find ads that have at least one completed reporter (not just fully completed ads)
    const ads = await freeAdModel.find({
      "acceptedReporters.postStatus": "completed" // ✅ Ads with at least one completed reporter
    }).lean();

    console.log(`📊 Found ${ads.length} ads with completed reporters`);

    // ✅ Process each ad with proof details
    const processedAds = await Promise.all(
      ads.map(async (ad) => {
        const totalAccepted = ad.acceptedReporters?.length || 0;
        const totalCompleted = ad.acceptedReporters?.filter(
          (r) => r.postStatus === "completed"
        ).length || 0;
        const totalRequired = ad.requiredReportersCount || 0;

        // ✅ Completed reporters with detailed info
        const completedReporters = await Promise.all(
          ad.acceptedReporters
            ?.filter((r) => r.postStatus === "completed")
            .map(async (r) => {
              // ✅ Determine user role based on iinsafId prefix
              const userRole = r.iinsafId?.startsWith('INF') ? 'Influencer' : 'Reporter';
              
              // ✅ Fetch proof details from FreeAdProof
              const proofDetails = await FreeAdProof.findOne({
                adId: ad._id,
                reporterId: r.reporterId,
                status: "completed"
              }).lean();

              return {
                reporterId: r.reporterId,
                iinsafId: r.iinsafId,
                userRole: userRole, // ✅ Fixed user role logic
                completedAt: r.completedAt,
                acceptedAt: r.acceptedAt,
                // ✅ Complete work submitted details
                proofDetails: proofDetails ? {
                  screenshot: proofDetails.screenshot,
                  videoLink: proofDetails.videoLink,
                  channelName: proofDetails.channelName,
                  platform: proofDetails.platform,
                  duration: proofDetails.duration,
                  submittedAt: proofDetails.submittedAt,
                  adminRejectNote: proofDetails.adminRejectNote,
                  status: proofDetails.status
                } : null
              };
            }) || []
        );

        return {
          _id: ad._id,
          adType: ad.adType,
          userType: ad.userType,
          mediaType: ad.mediaType,
          imageUrl: ad.imageUrl,
          videoUrl: ad.videoUrl,
          description: ad.description,
          state: ad.state,
          city: ad.city,
          allState: ad.allState,
          requiredReportersCount: totalRequired,
          status: ad.status,
          createdAt: ad.createdAt,
          updatedAt: ad.updatedAt,
          
          // ✅ Statistics
          totalAccepted,
          totalCompleted,
          totalRequired,
          completionRate: totalRequired > 0 ? (totalCompleted / totalRequired * 100).toFixed(1) : 0,
          isFullyCompleted: totalCompleted >= totalRequired,

          // ✅ Completed reporters with detailed info
          completedReporters,
        };
      })
    );

    // ✅ Filter and sort the processed ads
    const completedAds = processedAds
      .filter((ad) => ad.totalCompleted > 0) // ✅ Only ads with completed reporters
      .sort((a, b) => {
        // ✅ Sort by completion status first (fully completed first), then by completion rate
        if (a.isFullyCompleted !== b.isFullyCompleted) {
          return b.isFullyCompleted - a.isFullyCompleted;
        }
        return parseFloat(b.completionRate) - parseFloat(a.completionRate);
      });

    console.log(`✅ Returning ${completedAds.length} completed ads with completed reporters`);

    res.status(200).json({ 
      success: true, 
      data: completedAds,
      total: completedAds.length 
    });
  } catch (error) {
    console.error("Error fetching completed ads:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 🆕 Get targeted users (reporters/influencers) for a specific free ad
const getFreeAdTargetedUsers = async (req, res) => {
  try {
    const { adId } = req.params;
    console.log(`🔍 Getting targeted users for free ad: ${adId}`);

    // Find the free ad
    const ad = await freeAdModel.findById(adId);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Free ad not found" });
    }

    console.log(`📊 Free ad found:`, {
      adId: ad._id,
      userType: ad.userType,
      reportersIds: ad.reportersIds?.length || 0,
      influencersIds: ad.influencersIds?.length || 0,
      selectedReporters: ad.selectedReporters?.length || 0
    });

    // Get all targeted users (reporters + influencers)
    const allTargetedUserIds = [
      ...(ad.reportersIds || []),
      ...(ad.influencersIds || []),
      ...(ad.selectedReporters || [])
    ];

    // Remove duplicates
    const uniqueUserIds = [...new Set(allTargetedUserIds.map(id => id.toString()))];
    console.log(`📊 Unique targeted user IDs: ${uniqueUserIds.length}`);

    // Fetch user details
    const User = require("../../../../models/userModel/userModel");
    const users = await User.find({ _id: { $in: uniqueUserIds } })
      .select("name email iinsafId role state city organization mobile")
      .lean();

    console.log(`📊 Found ${users.length} users in database`);

    // Create a map of user responses from acceptedReporters
    const responseMap = {};
    if (ad.acceptedReporters) {
      ad.acceptedReporters.forEach(response => {
        responseMap[response.reporterId.toString()] = {
          status: response.postStatus,
          acceptedAt: response.acceptedAt,
          completedAt: response.completedAt,
          adProof: response.adProof
        };
      });
    }

    // Combine user data with response data
    const processedUsers = users.map(user => {
      const response = responseMap[user._id.toString()];
      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        iinsafId: user.iinsafId,
        role: user.role,
        state: user.state,
        city: user.city,
        organization: user.organization,
        mobile: user.mobile,
        status: response ? response.status : "pending",
        acceptedAt: response?.acceptedAt,
        completedAt: response?.completedAt,
        adProof: response?.adProof || false
      };
    });

    // Calculate statistics
    const stats = {
      totalUsers: processedUsers.length,
      totalReporters: processedUsers.filter(u => u.role === "Reporter").length,
      totalInfluencers: processedUsers.filter(u => u.role === "Influencer").length,
      pending: processedUsers.filter(u => u.status === "pending").length,
      accepted: processedUsers.filter(u => u.status === "accepted").length,
      submitted: processedUsers.filter(u => u.status === "submitted").length,
      completed: processedUsers.filter(u => u.status === "completed").length
    };

    console.log(`📊 Free ad targeting stats:`, stats);

    res.status(200).json({
      success: true,
      data: {
        adId: ad._id,
        adType: ad.adType,
        userType: ad.userType,
        description: ad.description,
        state: ad.state,
        city: ad.city,
        allState: ad.allState,
        requiredReportersCount: ad.requiredReportersCount,
        status: ad.status,
        createdAt: ad.createdAt,
        updatedAt: ad.updatedAt,
        users: processedUsers,
        statistics: stats
      }
    });

  } catch (error) {
    console.error("Error fetching free ad targeted users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


module.exports = {
  getPendingFreeAds,
  getApprovedFreeAds,
  getRunningFreeAds,
  getCompletedFreeAds,
  getFreeAdTargetedUsers,
};
