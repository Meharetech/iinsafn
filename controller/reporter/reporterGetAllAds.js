// const Adpost = require("../../models/advertismentPost/advertisementPost");
// const User = require("../../models/userModel/userModel");

// const reporterGetAllAds = async (req, res) => {
//   try {
//     const reporterId = req.user._id;

//     // Step 1: Fetch reporter info
//     const reporter = await User.findById(reporterId);
//     if (!reporter) {
//       return res.status(404).json({
//         success: false,
//         message: "Reporter not found",
//       });
//     }

//     // Step 2: Check verification
//     if (!reporter.verifiedReporter) {
//       return res.status(403).json({
//         success: false,
//         message: "You are not a verified reporter. Please apply for your ID card first.",
//       });
//     }

//     const { state: reporterState, city: reporterCity, pincode: reporterPincode } = req.user;

//     // Step 3: Fetch all approved ads
//     const allApprovedAds = await Adpost.find({ status: 'approved' });

//     // Step 4: Filter ads
//     const filteredAds = allApprovedAds.filter(ad => {
//       //  Skip if ad is already fulfilled
//       if (
//         typeof ad.requiredReporter === "number" &&
//         typeof ad.acceptReporterCount === "number" &&
//         ad.acceptReporterCount >= ad.requiredReporter
//       ) {
//         return false;
//       }

//       //  Skip if reporter already handled the ad
//       const alreadyHandled = ad.acceptRejectReporterList?.some(entry =>
//         entry.reporterId?.toString() === reporterId.toString()
//       );
//       if (alreadyHandled) return false;

//       //  Matching logic
//       if (ad.allStates === true) return true;
//       if (Array.isArray(ad.reporterId) && ad.reporterId.includes(String(reporterId))) return true;
//       if (ad.adminSelectPincode === reporterPincode) return true;
//       if (Array.isArray(ad.adminSelectCities) && ad.adminSelectCities.includes(reporterCity)) return true;
//       if (Array.isArray(ad.adminSelectState) && ad.adminSelectState.includes(reporterState)) return true;
//       if (
//         ad.adState === reporterState ||
//         ad.adCity === reporterCity ||
//         ad.pincode === reporterPincode
//       ) {
//         return true;
//       }

//       return false;
//     });

//     res.status(200).json({
//       success: true,
//       message: "Filtered ads fetched successfully",
//       data: filteredAds
//     });

//   } catch (error) {
//     console.error("Error fetching filtered ads for reporter:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching ads"
//     });
//   }
// };

// module.exports = reporterGetAllAds;

const Adpost = require("../../models/advertismentPost/advertisementPost");
const User = require("../../models/userModel/userModel");

const reporterGetAllAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Step 1: Fetch reporter info
    const reporter = await User.findById(reporterId);
    if (!reporter) {
      return res.status(404).json({
        success: false,
        message: "Reporter not found",
      });
    }

    // Step 2: Ensure user is verified (works for both reporters and influencers)
    if (!reporter.verifiedReporter) {
      const userType = reporter.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message:
          `You are not a verified ${userType}. Please apply for your ID card first.`,
      });
    }

    const { state: reporterState, city: reporterCity } = reporter;

    // Step 3: Fetch all approved and modified ads
    const allApprovedAds = await Adpost.find({ 
      status: { $in: ["approved", "modified"] } 
    });

    // Step 4: Filter ads according to strict priority
    const filteredAds = allApprovedAds.filter((ad) => {
      if (!reporter.verifiedReporter) return false;

      // Filter by user type - only show ads that match the user's role
      const userRole = reporter.role; // "Reporter" or "Influencer"
      const adUserType = ad.userType; // "reporter" or "influencer"
      
      // Convert user role to match ad userType format
      const expectedUserType = userRole === "Influencer" ? "influencer" : "reporter";
      
      // Only show ads that match the user's type
      if (adUserType !== expectedUserType) {
        return false;
      }

      // Skip if ad is already fulfilled
      if (ad.acceptReporterCount >= ad.requiredReporter) return false;

      // Skip if reporter already handled OR if reporter is not in the notification list
      const reporterEntry = ad.acceptRejectReporterList?.find(
        (e) => e.reporterId?.toString() === reporterId.toString()
      );
      
      // If reporter is not in the list at all, don't show the ad
      if (!reporterEntry) {
        return false;
      }
      
      // ✅ Filter logic: Only show ads where reporter hasn't responded yet
      // Status meanings:
      // - undefined/null = No response yet (should show in new ads)
      // - "pending" + adProof: false = No response yet (should show in new ads) 
      // - "accepted" = Reporter accepted (should NOT show in new ads - should be in accepted leads)
      // - "pending" + adProof: true = Proof submitted (should NOT show in new ads - should be in running ads)
      // - "approved" = Initial proof approved (should NOT show in new ads - should be in running ads)
      // - "rejected" = Reporter rejected (should NOT show in new ads)
      
      // If reporter has accepted the ad, don't show in new ads
      if (reporterEntry.postStatus === "accepted") {
        console.log(`🔍 Filtering out ad ${ad._id} - Reporter already accepted (status: accepted)`);
        return false;
      }
      
      // If reporter has rejected the ad, don't show in new ads
      if (reporterEntry.postStatus === "rejected") {
        console.log(`🔍 Filtering out ad ${ad._id} - Reporter already rejected (status: rejected)`);
        return false;
      }
      
      // If proof was already submitted (adProof: true), don't show in new ads
      if (reporterEntry.adProof === true) {
        console.log(`🔍 Filtering out ad ${ad._id} - Proof already submitted (adProof: true, postStatus: ${reporterEntry.postStatus})`);
        return false;
      }
      
      // If initial proof was approved, don't show in new ads
      if (reporterEntry.postStatus === "approved") {
        console.log(`🔍 Filtering out ad ${ad._id} - Initial proof approved (status: approved)`);
        return false;
      }

      // If reporter is in the acceptRejectReporterList and hasn't responded yet, show the ad
      // The targeting logic is already handled by notifyMatchingReporters function
      return true;
    });

    res.status(200).json({
      success: true,
      message: "Filtered ads fetched successfully",
      data: filteredAds,
    });
  } catch (error) {
    console.error("Error fetching filtered ads for reporter:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching ads",
    });
  }
};

module.exports = reporterGetAllAds;
