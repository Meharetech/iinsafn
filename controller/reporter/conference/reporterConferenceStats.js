const ReporterConference = require("../../../models/reporterConference/reporterConference");
const User = require("../../../models/userModel/userModel");

const getReporterConferenceStats = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // 1. Ensure reporter is verified
    const reporter = await User.findById(reporterId);
    if (!reporter || !reporter.verifiedReporter) {
      return res.status(403).json({
        success: false,
        message: "You are not a verified reporter. Please apply for your ID card first.",
      });
    }

    // 2. Get counts for different statuses
    const pendingCount = await ReporterConference.countDocuments({
      reporterId: reporterId,
      status: "pending",
    });

    const acceptedCount = await ReporterConference.countDocuments({
      reporterId: reporterId,
      status: "accepted",
    });

    const rejectedCount = await ReporterConference.countDocuments({
      reporterId: reporterId,
      status: "rejected",
    });

    const completedCount = await ReporterConference.countDocuments({
      reporterId: reporterId,
      status: "completed",
    });

    res.status(200).json({
      success: true,
      message: "Reporter conference stats fetched successfully",
      data: {
        pending: pendingCount,
        accepted: acceptedCount,
        rejected: rejectedCount,
        completed: completedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching reporter conference stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conference stats",
    });
  }
};

module.exports = getReporterConferenceStats;
