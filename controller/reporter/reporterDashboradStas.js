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

    // fetch only approved ads for the user's role (Reporter or Influencer)
    const allApprovedAds = await Adpost.find({ 
      status: "approved",
      userType: role // Target ads based on user's role
    });

    // ✅ Pending ads logic (only ads with same state & city as reporter)
    const filteredPending = allApprovedAds.filter((ad) => {
      // must match state + city
      if (ad.adState !== userState || ad.adCity !== userCity) {
        return false;
      }

      // skip if already full
      if (
        typeof ad.requiredReporter === "number" &&
        typeof ad.acceptReporterCount === "number" &&
        ad.acceptReporterCount >= ad.requiredReporter
      ) {
        return false;
      }

      // skip if already accepted/rejected by this reporter
      const alreadyHandled = ad.acceptRejectReporterList?.some(
        (entry) => entry.reporterId?.toString() === userId.toString()
      );
      if (alreadyHandled) return false;

      return true;
    });

    const pendingCount = filteredPending.length;

    // ✅ Other counts remain same
    const acceptedCount = await Adpost.countDocuments({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          accepted: true,
          adProof: false,
        },
      },
      userType: role
    });

    const rejectedCount = await Adpost.countDocuments({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: userId,
          accepted: false,
        },
      },
      userType: role
    });

    const runningCount = await reporterAdProof.countDocuments({
      proofs: {
        $elemMatch: {
          reporterId: userId,
          status: "running",
        },
      },
    });

    const completedCount = await reporterAdProof.countDocuments({
      proofs: {
        $elemMatch: {
          reporterId: userId,
          status: "completed",
        },
      },
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
    });
  }
};

module.exports = getReporterAdCounts;
