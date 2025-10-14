const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const User = require("../../../models/userModel/userModel");

const getInfluencerFreeAds = async (req, res) => {
  try {
    const influencerId = req.user._id;

    console.log(`🔍 Fetching free ads for influencer: ${influencerId}`);

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

    const { state: influencerState, city: influencerCity } = user;

    console.log(`🔍 Influencer details: ${user.name}, State: ${influencerState}, City: ${influencerCity}`);

    // Step 4: Fetch all approved and modified free ads
    const allFreeAds = await freeAdModel.find({ 
      status: { $in: ["approved", "modified"] },
      // Only show ads that are meant for influencers
      userType: { $in: ["influencer", "both"] }
    });

    console.log(`🔍 Found ${allFreeAds.length} ads with influencer/both userType`);

    // Step 5: Filter ads to show only those sent to this specific influencer
    const filteredFreeAds = allFreeAds.filter(ad => {
      console.log(`\n🔍 Processing Ad ${ad._id}:`);
      console.log(`   - Ad userType: ${ad.userType}`);
      console.log(`   - Ad allState: ${ad.allState}`);
      console.log(`   - Ad influencersIds: ${JSON.stringify(ad.influencersIds)}`);
      console.log(`   - Ad state: ${JSON.stringify(ad.state)}`);
      console.log(`   - Ad city: ${JSON.stringify(ad.city)}`);

      // ✅ Check if influencer already responded to this ad
      const influencerEntry = ad.acceptedReporters?.find(
        r => r.reporterId.toString() === influencerId.toString()
      );
      
      if (influencerEntry && influencerEntry.postStatus && influencerEntry.postStatus !== "pending") {
        console.log(`   ❌ Influencer already responded with status: ${influencerEntry.postStatus}`);
        return false;
      }
      
      console.log(`   ✅ Influencer entry status: ${influencerEntry?.postStatus || 'N/A'}`);

      // 🔑 CRITICAL FIX: Only show ads where influencer is explicitly targeted
      // Check if influencer is in the influencersIds array (this means they were specifically sent this ad)
      if (Array.isArray(ad.influencersIds) && ad.influencersIds.length > 0) {
        const isSpeciallySelected = ad.influencersIds.some(id => id.toString() === influencerId.toString());
        if (isSpeciallySelected) {
          console.log(`   ✅ Influencer is specifically selected in influencersIds`);
          return true;
        }
      }

      // 🔑 CRITICAL FIX: Only show "all states" ads if influencer is verified
      // AND the ad was created for all states (not location-specific)
      if (ad.allState === true) {
        console.log(`   ✅ Ad is for all states and influencer is verified`);
        return true;
      }

      // 🔑 CRITICAL FIX: Remove location-based filtering
      // We should only show ads where the user was explicitly targeted via influencersIds
      // Location-based filtering can cause ads to show to unintended users
      
      console.log(`   ❌ Influencer not in targeted users list`);
      return false;
    });

    console.log(`🔍 Filtered to ${filteredFreeAds.length} ads for influencer ${influencerId}`);

    res.status(200).json({
      success: true,
      message: "Influencer free ads fetched successfully",
      data: filteredFreeAds,
      totalCount: filteredFreeAds.length,
      influencerInfo: {
        name: user.name,
        state: influencerState,
        city: influencerCity,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error("Error fetching influencer free ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching influencer free ads",
      error: error.message
    });
  }
};

module.exports = getInfluencerFreeAds;
