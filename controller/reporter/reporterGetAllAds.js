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

    // Step 2: ✅ STRICT VERIFICATION CHECK - Only verified users can see paid ads
    // Check if user has verified ID card (verifiedReporter field)
    if (!reporter.verifiedReporter) {
      const userType = reporter.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `You are not a verified ${userType}. Please apply for and get your ID card approved first to view paid advertisements.`,
        data: [] // Return empty array
      });
    }

    // ✅ Additional check: Verify ID card status is actually "Approved"
    const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");
    const idCard = await genrateIdCard.findOne({ reporter: reporterId });

    if (!idCard || idCard.status !== "Approved") {
      const userType = reporter.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `Your ID card is not approved yet. Please wait for admin approval to view paid advertisements.`,
        data: [] // Return empty array
      });
    }

    const { state: reporterState, city: reporterCity } = reporter;

    // Step 3: Fetch all approved and modified ads that have not expired
    const now = new Date();
    const allApprovedAds = await Adpost.find({
      status: { $in: ["approved", "modified"] },
      acceptBefore: { $gt: now } // ✅ Only show ads where acceptance deadline is in the future
    });

    // Step 4: Filter ads according to strict priority
    // ✅ Only show ads to verified users (already checked above, but double-check for safety)
    const filteredAds = allApprovedAds.filter((ad) => {
      // ✅ CRITICAL: Only verified users can see paid ads
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

      // ✅ Use postStatus instead of accepted field
      // If reporter has already responded (not pending), don't show the ad
      if (reporterEntry.postStatus && reporterEntry.postStatus !== "pending") {
        return false;
      }

      // If reporter is in the acceptRejectReporterList and hasn't responded yet (pending), show the ad
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
