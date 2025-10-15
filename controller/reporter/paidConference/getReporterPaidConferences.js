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

    // Check if reporter is verified
    if (!reporter.verifiedReporter) {
      return res.status(403).json({
        success: false,
        message: "Only verified reporters can access paid conferences"
      });
    }

    const reporterState = reporter.state;
    const reporterCity = reporter.city;
    console.log("User state:", reporterState, "User city:", reporterCity);

    // Find ALL paid conferences that match reporter's targeting (regardless of status)
    // This includes: approved, modified, running, completed, etc. - any conference that was sent to this reporter
    const conferences = await PaidConference.find({
      paymentStatus: "paid",
      // 🔑 CRITICAL FIX: Exclude conferences where this reporter has already responded
      $and: [
        { "acceptedReporters.reporterId": { $ne: reporterId } },
        { "rejectedReporters.reporterId": { $ne: reporterId } }
      ]
    })
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 });

    // Filter conferences based on comprehensive targeting logic
    const filteredConferences = conferences.filter(conference => {
      // Check if reporter is excluded by admin
      if (conference.excludedReporters && conference.excludedReporters.length > 0) {
        const isExcluded = conference.excludedReporters.some(
          excludedId => excludedId.toString() === reporterId.toString()
        );
        if (isExcluded) {
          console.log(`Reporter ${reporterId} is excluded from paid conference ${conference.conferenceId} by admin`);
          return false;
        }
      }

      // Priority 1: Specific reporter selection
      if (conference.reporterId && conference.reporterId.length > 0) {
        const isSelectedReporter = conference.reporterId.includes(reporterId.toString());
        console.log(`Conference ${conference.conferenceId} has specific reporters:`, conference.reporterId);
        console.log(`Reporter ${reporterId} is selected: ${isSelectedReporter}`);
        return isSelectedReporter;
      }
      // Priority 2: Admin selected states and cities
      else if (conference.adminSelectState && conference.adminSelectState.length > 0) {
        console.log(`Conference ${conference.conferenceId} has admin selected states:`, conference.adminSelectState);
        
        // Check if reporter's state is in admin selected states
        const stateMatch = conference.adminSelectState.includes(reporterState);
        console.log(`State match: ${stateMatch}`);
        
        // If cities are also selected, check both state and city
        if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
          const cityMatch = conference.adminSelectCities.includes(reporterCity);
          console.log(`City match: ${cityMatch}`);
          return stateMatch && cityMatch;
        }
        
        return stateMatch;
      }
      // Priority 3: Admin selected cities only
      else if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
        const cityMatch = conference.adminSelectCities.includes(reporterCity);
        console.log(`Conference ${conference.conferenceId} admin selected cities match: ${cityMatch}`);
        return cityMatch;
      }
      // Priority 4: Default behavior - match by original state and city
      else {
        const originalStateMatch = conference.state === reporterState;
        const originalCityMatch = conference.city === reporterCity;
        console.log(`Conference ${conference.conferenceId} original targeting: state=${originalStateMatch}, city=${originalCityMatch}`);
        return originalStateMatch && originalCityMatch;
      }
    });

    console.log("Found paid conferences:", filteredConferences.length);
    
    // Debug: Log commission details for each conference
    filteredConferences.forEach((conf, index) => {
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
      data: filteredConferences
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
        { status: "approved" },
        { status: "modified" }
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
          { status: "approved" },
          { status: "modified" }
        ]
      }
    });

    console.log("Found accepted paid conferences:", conferences.length);
    
    // Debug: Log each conference found
    conferences.forEach((conf, index) => {
      console.log(`Accepted Conference ${index + 1}:`, {
        conferenceId: conf.conferenceId,
        status: conf.status,
        topic: conf.topic,
        hasAcceptedReporters: !!conf.acceptedReporters,
        acceptedReportersCount: conf.acceptedReporters?.length || 0,
        reporterInAccepted: conf.acceptedReporters?.some(r => r.reporterId.toString() === reporterId.toString())
      });
    });

    // Process conferences to include reporter-specific data
    const processedConferences = conferences.map(conference => {
      // Find the current reporter's acceptance data
      const reporterAcceptance = conference.acceptedReporters.find(
        reporter => reporter.reporterId.toString() === reporterId.toString()
      );
      
      // Debug logging for data structure
      console.log(`Processing conference ${conference.conferenceId}:`, {
        status: conference.status,
        hasTopic: !!conference.topic,
        hasPurpose: !!conference.purpose,
        hasReporterAcceptance: !!reporterAcceptance,
        proofStatus: reporterAcceptance?.proof?.status,
        proofSubmitted: reporterAcceptance?.proofSubmitted
      });
      
      return {
        ...conference.toObject(),
        // Direct field access for backward compatibility
        topic: conference.topic,
        purpose: conference.purpose,
        conferenceDate: conference.conferenceDate,
        conferenceTime: conference.conferenceTime,
        timePeriod: conference.timePeriod,
        state: conference.state,
        city: conference.city,
        place: conference.place,
        landmark: conference.landmark,
        adminNote: conference.adminNote,
        // Reporter-specific data
        acceptedAt: reporterAcceptance?.acceptedAt,
        proofSubmitted: reporterAcceptance?.proofSubmitted || false,
        proof: reporterAcceptance?.proof,
        proofStatus: reporterAcceptance?.proof?.status || "pending",
        adminRejectNote: reporterAcceptance?.proof?.adminNote || null,
        rejectedAt: reporterAcceptance?.proof?.rejectedAt || null,
        canResubmit: reporterAcceptance?.proof?.status === "rejected",
        // Conference details object for frontend compatibility
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
        // Direct field access for backward compatibility
        topic: conference.topic,
        purpose: conference.purpose,
        conferenceDate: conference.conferenceDate,
        conferenceTime: conference.conferenceTime,
        timePeriod: conference.timePeriod,
        state: conference.state,
        city: conference.city,
        place: conference.place,
        landmark: conference.landmark,
        adminNote: conference.adminNote,
        // Reporter-specific data
        rejectedAt: reporterRejection?.rejectedAt,
        rejectNote: reporterRejection?.rejectNote,
        // Conference details object for frontend compatibility
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
    // This should include conferences from any status (approved, modified, running) that have approved proofs
    const conferences = await PaidConference.find({
      "acceptedReporters.reporterId": reporterId,
      "acceptedReporters.proofSubmitted": true,
      "acceptedReporters.proof.status": "approved"
    })
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 });

    console.log("Found completed paid conferences:", conferences.length);
    
    // Debug: Log each completed conference found
    conferences.forEach((conf, index) => {
      console.log(`Completed Conference ${index + 1}:`, {
        conferenceId: conf.conferenceId,
        status: conf.status,
        topic: conf.topic,
        hasAcceptedReporters: !!conf.acceptedReporters,
        acceptedReportersCount: conf.acceptedReporters?.length || 0,
        reporterInAccepted: conf.acceptedReporters?.some(r => r.reporterId.toString() === reporterId.toString()),
        reporterProofStatus: conf.acceptedReporters?.find(r => r.reporterId.toString() === reporterId.toString())?.proof?.status
      });
    });

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
        // Direct field access for backward compatibility
        topic: conference.topic,
        purpose: conference.purpose,
        conferenceDate: conference.conferenceDate,
        conferenceTime: conference.conferenceTime,
        timePeriod: conference.timePeriod,
        state: conference.state,
        city: conference.city,
        place: conference.place,
        landmark: conference.landmark,
        adminNote: conference.adminNote,
        // Reporter-specific data
        acceptedAt: reporterAcceptance?.acceptedAt,
        proofSubmitted: reporterAcceptance?.proofSubmitted || false,
        proof: reporterAcceptance?.proof,
        proofStatus: reporterAcceptance?.proof?.status || "approved",
        earnings: earnings,
        amountEarned: earnings,
        completedAt: reporterAcceptance?.proof?.approvedAt || conference.updatedAt,
        // Conference details object for frontend compatibility
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

    // Count new paid conferences (all statuses that were sent to this reporter)
    const newCount = await PaidConference.countDocuments({
      paymentStatus: "paid",
      // This is a simplified count - actual filtering happens in getNewPaidConferences
      state: reporterState
    });

    // Count accepted paid conferences
    const acceptedCount = await PaidConference.countDocuments({
      "acceptedReporters.reporterId": reporterId,
      status: { $in: ["running", "approved", "modified"] }
    });

    // Count rejected paid conferences
    const rejectedCount = await PaidConference.countDocuments({
      "rejectedReporters.reporterId": reporterId
    });

    // Count completed paid conferences
    const completedCount = await PaidConference.countDocuments({
      "acceptedReporters.reporterId": reporterId,
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
