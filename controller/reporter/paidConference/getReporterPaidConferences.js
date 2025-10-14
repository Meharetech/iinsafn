const PaidConference = require("../../../models/pressConference/paidConference");
const User = require("../../../models/userModel/userModel");

// Get new paid conferences for reporter
const getNewPaidConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;
    console.log("Getting new paid conferences for reporter:", reporterId);

    // Get reporter's state
    const reporter = await User.findById(reporterId);
    if (!reporter) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const reporterState = reporter.state;
    console.log("User state:", reporterState);

    // Find approved paid conferences that match reporter's state
    const conferences = await PaidConference.find({
      status: { $in: ["approved", "modified"] },
      paymentStatus: "paid",
      $or: [
        // Match by original state
        { state: reporterState },
        // Match by modified states (when admin selects specific states)
        { modifiedStates: { $in: [reporterState] } }
      ],
      // 🔑 CRITICAL FIX: Exclude conferences where this reporter has already responded
      $and: [
        { "acceptedReporters.reporterId": { $ne: reporterId } },
        { "rejectedReporters.reporterId": { $ne: reporterId } }
      ]
    })
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 });

    console.log("Found paid conferences:", conferences.length);
    
    // Debug: Log commission details for each conference
    conferences.forEach((conf, index) => {
      console.log(`Conference ${index + 1} (${conf.conferenceId}):`, {
        paymentAmount: conf.paymentAmount,
        numberOfReporters: conf.numberOfReporters,
        acceptedReporters: conf.acceptedReporters?.length || 0,
        rejectedReporters: conf.rejectedReporters?.length || 0,
        commissionDetails: conf.commissionDetails,
        status: conf.status,
        availableForReporter: conf.acceptedReporters?.length < conf.numberOfReporters
      });
    });

    res.status(200).json({
      success: true,
      data: conferences
    });
  } catch (error) {
    console.error("Error fetching new paid conferences:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get accepted paid conferences for reporter
const getAcceptedPaidConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;
    console.log("Getting accepted paid conferences for reporter:", reporterId);

    // First, let's check all paid conferences to debug
    const allConferences = await PaidConference.find({}).populate('submittedBy', 'name email');
    console.log("Total paid conferences in database:", allConferences.length);
    
    allConferences.forEach((conf, index) => {
      console.log(`Conference ${index + 1}:`, {
        conferenceId: conf.conferenceId,
        status: conf.status,
        acceptedReporters: conf.acceptedReporters?.length || 0,
        acceptedReportersIds: conf.acceptedReporters?.map(r => r.reporterId.toString()) || []
      });
    });

    // Find paid conferences accepted by this reporter
    const conferences = await PaidConference.find({
      "acceptedReporters.reporterId": reporterId,
      $or: [
        { status: "running" },
        { status: "approved" }
      ]
    })
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 });

    console.log("Query details:", {
      reporterId: reporterId.toString(),
      query: {
        "acceptedReporters.reporterId": reporterId,
        $or: [
          { status: "running" },
          { status: "approved" }
        ]
      }
    });

    console.log("Found accepted paid conferences:", conferences.length);

    // Process conferences to include reporter-specific data
    const processedConferences = conferences.map(conference => {
      // Find the current reporter's acceptance data
      const reporterAcceptance = conference.acceptedReporters.find(
        reporter => reporter.reporterId.toString() === reporterId.toString()
      );
      
      return {
        ...conference.toObject(),
        acceptedAt: reporterAcceptance?.acceptedAt,
        proofSubmitted: reporterAcceptance?.proofSubmitted || false,
        proof: reporterAcceptance?.proof,
        proofStatus: reporterAcceptance?.proof?.status || "pending",
        adminRejectNote: reporterAcceptance?.proof?.adminNote || null,
        rejectedAt: reporterAcceptance?.proof?.rejectedAt || null,
        canResubmit: reporterAcceptance?.proof?.status === "rejected",
        conferenceDetails: {
          topic: conference.topic,
          purpose: conference.purpose,
          conferenceDate: conference.conferenceDate,
          conferenceTime: conference.conferenceTime,
          timePeriod: conference.timePeriod,
          state: conference.state,
          city: conference.city,
          place: conference.place,
          landmark: conference.landmark,
          adminNote: conference.adminNote
        }
      };
    });

    console.log("Processed conferences:", processedConferences.length);

    res.status(200).json({
      success: true,
      data: processedConferences
    });
  } catch (error) {
    console.error("Error fetching accepted paid conferences:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get rejected paid conferences for reporter
const getRejectedPaidConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;
    console.log("Getting rejected paid conferences for reporter:", reporterId);

    // Find paid conferences rejected by this reporter
    const conferences = await PaidConference.find({
      "rejectedReporters.reporterId": reporterId
    })
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 });

    console.log("Found rejected paid conferences:", conferences.length);

    // Process conferences to include reporter-specific data
    const processedConferences = conferences.map(conference => {
      // Find the current reporter's rejection data
      const reporterRejection = conference.rejectedReporters.find(
        reporter => reporter.reporterId.toString() === reporterId.toString()
      );
      
      return {
        ...conference.toObject(),
        rejectedAt: reporterRejection?.rejectedAt,
        rejectNote: reporterRejection?.rejectNote,
        conferenceDetails: {
          topic: conference.topic,
          purpose: conference.purpose,
          conferenceDate: conference.conferenceDate,
          conferenceTime: conference.conferenceTime,
          timePeriod: conference.timePeriod,
          state: conference.state,
          city: conference.city,
          place: conference.place,
          landmark: conference.landmark,
          adminNote: conference.adminNote
        }
      };
    });

    console.log("Processed rejected conferences:", processedConferences.length);

    res.status(200).json({
      success: true,
      data: processedConferences
    });
  } catch (error) {
    console.error("Error fetching rejected paid conferences:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get completed paid conferences for reporter
const getCompletedPaidConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;
    console.log("Getting completed paid conferences for reporter:", reporterId);

    // Find paid conferences where this reporter has completed their work (proof approved)
    const conferences = await PaidConference.find({
      "acceptedReporters.reporterId": reporterId,
      "acceptedReporters.status": "completed",
      "acceptedReporters.proofSubmitted": true,
      "acceptedReporters.proof.status": "approved"
    })
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 });

    console.log("Found completed paid conferences:", conferences.length);

    // Process conferences to include reporter-specific data and earnings
    const processedConferences = conferences.map(conference => {
      // Find the current reporter's acceptance data
      const reporterAcceptance = conference.acceptedReporters.find(
        reporter => reporter.reporterId.toString() === reporterId.toString()
      );
      
      // Calculate earnings
      const earnings = conference.commissionDetails?.amountPerReporter || 
                      (conference.paymentAmount / conference.numberOfReporters) || 0;
      
      return {
        ...conference.toObject(),
        acceptedAt: reporterAcceptance?.acceptedAt,
        proofSubmitted: reporterAcceptance?.proofSubmitted || false,
        proof: reporterAcceptance?.proof,
        earnings: earnings,
        amountEarned: earnings,
        completedAt: reporterAcceptance?.proof?.approvedAt || conference.updatedAt,
        conferenceDetails: {
          topic: conference.topic,
          purpose: conference.purpose,
          conferenceDate: conference.conferenceDate,
          conferenceTime: conference.conferenceTime,
          timePeriod: conference.timePeriod,
          state: conference.state,
          city: conference.city,
          place: conference.place,
          landmark: conference.landmark,
          adminNote: conference.adminNote
        }
      };
    });

    console.log("Processed completed conferences:", processedConferences.length);

    res.status(200).json({
      success: true,
      data: processedConferences
    });
  } catch (error) {
    console.error("Error fetching completed paid conferences:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get paid conference stats for reporter
const getPaidConferenceStats = async (req, res) => {
  try {
    const reporterId = req.user._id;
    console.log("Getting paid conference stats for reporter:", reporterId);

    // Get reporter's state
    const reporter = await User.findById(reporterId);
    if (!reporter) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const reporterState = reporter.state;

    // Count new paid conferences
    const newCount = await PaidConference.countDocuments({
      status: "approved",
      state: reporterState,
      paymentStatus: "paid"
    });

    // Count accepted paid conferences
    const acceptedCount = await PaidConference.countDocuments({
      "acceptedUsers.reporterId": reporterId,
      status: "running"
    });

    // Count rejected paid conferences
    const rejectedCount = await PaidConference.countDocuments({
      "rejectedUsers.reporterId": reporterId
    });

    // Count completed paid conferences
    const completedCount = await PaidConference.countDocuments({
      "acceptedUsers.reporterId": reporterId,
      status: "completed"
    });

    const stats = {
      newPaidConferences: newCount,
      acceptedPaidConferences: acceptedCount,
      rejectedPaidConferences: rejectedCount,
      completedPaidConferences: completedCount
    };

    console.log("Paid conference stats:", stats);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching paid conference stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  getNewPaidConferences,
  getAcceptedPaidConferences,
  getRejectedPaidConferences,
  getCompletedPaidConferences,
  getPaidConferenceStats
};
