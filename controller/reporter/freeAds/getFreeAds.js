const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const User = require("../../../models/userModel/userModel");

const getFreeAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    console.log(`🔍 Fetching free ads for reporter: ${reporterId}`);

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

    const { state: reporterState, city: reporterCity } = user;

    console.log(`🔍 Reporter details: ${user.name}, State: ${reporterState}, City: ${reporterCity}`);

    // Step 4: Fetch all approved and modified free ads
    const allFreeAds = await freeAdModel.find({ 
      status: { $in: ["approved", "modified"] },
      // Only show ads that are meant for reporters
      userType: { $in: ["reporter", "both"] }
    });

    console.log(`🔍 Found ${allFreeAds.length} ads with reporter/both userType`);

    // Step 5: Filter ads to show only those sent to this specific reporter
    const filteredFreeAds = allFreeAds.filter(ad => {
      console.log(`\n🔍 Processing Ad ${ad._id}:`);
      console.log(`   - Ad userType: ${ad.userType}`);
      console.log(`   - Ad allState: ${ad.allState}`);
      console.log(`   - Ad reportersIds: ${JSON.stringify(ad.reportersIds)}`);
      console.log(`   - Ad state: ${JSON.stringify(ad.state)}`);
      console.log(`   - Ad city: ${JSON.stringify(ad.city)}`);

      // ✅ Check if reporter already responded to this ad
      const reporterEntry = ad.acceptedReporters?.find(
        r => r.reporterId.toString() === reporterId.toString()
      );
      
      if (reporterEntry && reporterEntry.postStatus && reporterEntry.postStatus !== "pending") {
        console.log(`   ❌ Reporter already responded with status: ${reporterEntry.postStatus}`);
        return false;
      }
      
      console.log(`   ✅ Reporter entry status: ${reporterEntry?.postStatus || 'N/A'}`);

      // 🔑 CRITICAL FIX: Only show ads where reporter is explicitly targeted
      // Check if reporter is in the reportersIds array (this means they were specifically sent this ad)
      if (Array.isArray(ad.reportersIds) && ad.reportersIds.length > 0) {
        const isSpeciallySelected = ad.reportersIds.some(id => id.toString() === reporterId.toString());
        if (isSpeciallySelected) {
          console.log(`   ✅ Reporter is specifically selected in reportersIds`);
          return true;
        }
      }

      // 🔑 CRITICAL FIX: Only show "all states" ads if reporter is verified
      // AND the ad was created for all states (not location-specific)
      if (ad.allState === true) {
        console.log(`   ✅ Ad is for all states and reporter is verified`);
        return true;
      }

      // 🔑 CRITICAL FIX: Remove location-based filtering
      // We should only show ads where the user was explicitly targeted via reportersIds
      // Location-based filtering can cause ads to show to unintended users
      
      console.log(`   ❌ Reporter not in targeted users list`);
      return false;
    });

    console.log(`🔍 Filtered to ${filteredFreeAds.length} ads for reporter ${reporterId}`);

    res.status(200).json({
      success: true,
      message: "Reporter free ads fetched successfully",
      data: filteredFreeAds,
      totalCount: filteredFreeAds.length,
      reporterInfo: {
        name: user.name,
        state: reporterState,
        city: reporterCity,
        verifiedReporter: user.verifiedReporter
      }
    });

  } catch (error) {
    console.error("Error fetching reporter free ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reporter free ads",
      error: error.message
    });
  }
};

module.exports = getFreeAds;
