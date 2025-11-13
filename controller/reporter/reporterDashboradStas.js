// const Adpost = require("../../models/advertismentPost/advertisementPost");
// const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");
// const User = require("../../models/userModel/userModel");

// const getReporterAdCounts = async (req, res) => {
//   try {
//     const reporterId = req.user._id;

//     // 1. Ensure reporter is verified
//     const reporter = await User.findById(reporterId);
//     if (!reporter || !reporter.verifiedReporter) {
//       return res.status(403).json({
//         success: false,
//         message:
//           "You are not a verified reporter. Please apply for your ID card first.",
//       });
//     }

//     const {
//       state: reporterState,
//       city: reporterCity,
//       pincode: reporterPincode,
//     } = reporter;

//     // fetch only approved ads
//     const allApprovedAds = await Adpost.find({ status: "approved" });

//     const filteredPending = allApprovedAds.filter((ad) => {
//       // skip if already full
//       if (
//         typeof ad.requiredReporter === "number" &&
//         typeof ad.acceptReporterCount === "number" &&
//         ad.acceptReporterCount >= ad.requiredReporter
//       ) {
//         return false;
//       }

//       // skip if already accepted/rejected
//       const alreadyHandled = ad.acceptRejectReporterList?.some(
//         (entry) => entry.reporterId?.toString() === reporterId.toString()
//       );
//       if (alreadyHandled) return false;

//       // Priority 1: Reporter is explicitly selected
//       if (
//         Array.isArray(ad.reporterId) &&
//         ad.reporterId.includes(String(reporterId))
//       )
//         return true;

//       // Priority 2: Admin selected state/city
//       if (
//         Array.isArray(ad.adminSelectState) &&
//         ad.adminSelectState.includes(reporterState)
//       )
//         return true;
//       if (
//         Array.isArray(ad.adminSelectCities) &&
//         ad.adminSelectCities.includes(reporterCity)
//       )
//         return true;

//       // Priority 3: Send to all reporters
//       if (ad.allStates === true) return true;

//       // Priority 4: PF targeting
//       if (ad.pfState === reporterState) {
//         if (Array.isArray(ad.pfCities) && ad.pfCities.length > 0) {
//           if (ad.pfCities.includes(reporterCity)) return true;
//         } else {
//           return true; // state-level PF match
//         }
//       }

//       // Priority 5: Ad-level targeting
//       if (ad.adState === reporterState) {
//         if (Array.isArray(ad.adCities) && ad.adCities.length > 0) {
//           // Must match both state + city
//           return ad.adCities.includes(reporterCity);
//         }
//         // No cities in ad → only state match
//         return true;
//       }
//       return false;
//     });

//     const pendingCount = filteredPending.length;


//     // --- Other counts remain same ---

//     const acceptedCount = await Adpost.countDocuments({
//       acceptRejectReporterList: {
//         $elemMatch: {
//           reporterId: reporterId,
//           accepted: true,
//           adProof: false,
//         },
//       },
//     });

//     const rejectedCount = await Adpost.countDocuments({
//       acceptRejectReporterList: {
//         $elemMatch: {
//           reporterId: reporterId,
//           accepted: false,
//         },
//       },
//     });

//     const runningCount = await reporterAdProof.countDocuments({
//       proofs: {
//         $elemMatch: {
//           reporterId: reporterId,
//           status: "running",
//         },
//       },
//     });

//     const completedCount = await reporterAdProof.countDocuments({
//       proofs: {
//         $elemMatch: {
//           reporterId: reporterId,
//           status: "completed",
//         },
//       },
//     });

//     res.status(200).json({
//       success: true,
//       message: "Reporter ads count fetched successfully",
//       data: {
//         pending: pendingCount,
//         accepted: acceptedCount,
//         rejected: rejectedCount,
//         running: runningCount,
//         completed: completedCount,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching reporter ad counts:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching reporter ad counts",
//     });
//   }
// };

// module.exports = getReporterAdCounts;








const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");
const User = require("../../models/userModel/userModel");

const getReporterAdCounts = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Get user details and check if verified
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is verified (works for both reporter and influencer)
    const isVerified = user.role === 'Reporter' ? user.verifiedReporter : user.verifiedInfluencer;
    if (!isVerified) {
      return res.status(403).json({
        success: false,
        message: "You are not verified. Please apply for your ID card first.",
      });
    }

    const { state: userState, city: userCity, role } = user;
    const userType = role === "Influencer" ? "influencer" : "reporter";

    // ✅ 1. PENDING COUNT (New Advertisements)
    // Ads that are approved/modified and reporter hasn't responded yet
    // Logic matches reporterGetAllAds.js
    const allApprovedAds = await Adpost.find({ 
      status: { $in: ["approved", "modified"] },
      userType: userType
    });

    const pendingAds = allApprovedAds.filter((ad) => {
      // Skip if ad is already full
      if (ad.acceptReporterCount >= ad.requiredReporter) {
        return false;
      }

      // Check if reporter is in the targeted list
      const reporterEntry = ad.acceptRejectReporterList?.find(
        (e) => e.reporterId?.toString() === userId.toString()
      );
      
      // If reporter is not in the list at all, don't show
      if (!reporterEntry) {
        return false;
      }
      
      // If reporter has accepted the ad, don't show in new ads
      if (reporterEntry.postStatus === "accepted") {
        return false;
      }
      
      // If reporter has rejected the ad, don't show in new ads
      if (reporterEntry.postStatus === "rejected") {
        return false;
      }
      
      // If proof was already submitted (adProof: true), don't show in new ads
      if (reporterEntry.adProof === true) {
        return false;
      }
      
      // If initial proof was approved, don't show in new ads
      if (reporterEntry.postStatus === "approved") {
        return false;
      }

      // If reporter is in the acceptRejectReporterList and hasn't responded yet, show the ad
      return true;
    });

    const pendingCount = pendingAds.length;

    // ✅ 2. ACCEPTED COUNT (Accepted Leads)
    // Ads where reporter accepted but hasn't submitted proof yet
    const acceptedCount = await Adpost.countDocuments({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          postStatus: "accepted", // ✅ Use postStatus field
          adProof: false // ✅ Only count if proof not submitted yet
        }
      },
      userType: userType
    });

    // ✅ 3. REJECTED COUNT (Rejected Advertisements)
    // Ads where reporter rejected
    const rejectedCount = await Adpost.countDocuments({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          postStatus: "rejected" // ✅ Use postStatus field
        }
      },
      userType: userType
    });

    // ✅ 4. RUNNING COUNT (Running Advertisements)
    // Ads where proof was submitted (status: pending, approved, submitted, or rejected in proof)
    const runningCount = await reporterAdProof.countDocuments({
      proofs: {
        $elemMatch: {
          reporterId: userId,
          status: { $in: ["pending", "approved", "submitted", "rejected"] } // ✅ All active proof statuses
        }
      }
    });

    // ✅ 5. COMPLETED COUNT (Completed Advertisements)
    // Ads where proof status is "completed" (work completed and payment credited)
    const completedCount = await reporterAdProof.countDocuments({
      proofs: {
        $elemMatch: {
          reporterId: userId,
          status: "completed" // ✅ Final completed status
        }
      }
    });

    console.log(`📊 Advertisement Stats for ${role} (${userId}):`, {
      pending: pendingCount,
      accepted: acceptedCount,
      rejected: rejectedCount,
      running: runningCount,
      completed: completedCount
    });

    res.status(200).json({
      success: true,
      message: `${role} ads count fetched successfully`,
      data: {
        pending: pendingCount,
        accepted: acceptedCount,
        rejected: rejectedCount,
        running: runningCount,
        completed: completedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching user ad counts:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user ad counts",
      error: error.message
    });
  }
};

module.exports = getReporterAdCounts;
