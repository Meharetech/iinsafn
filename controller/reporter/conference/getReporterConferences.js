const FreeConference = require("../../../models/pressConference/freeConference");
const ReporterConference = require("../../../models/reporterConference/reporterConference");
const User = require("../../../models/userModel/userModel");

// Get new conferences for reporter (not yet accepted/rejected)
const getNewConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { state: reporterState, city: reporterCity } = req.user;

    // 1. Ensure reporter is verified
    const reporter = await User.findById(reporterId);
    if (!reporter || !reporter.verifiedReporter) {
      return res.status(403).json({
        success: false,
        message: "You are not a verified reporter. Please apply for your ID card first.",
      });
    }

    // 2. Get all approved conferences (only after admin approval)
    const approvedConferences = await FreeConference.find({ 
      status: { $in: ["approved", "modified"] }
    }).populate("submittedBy", "name email organization pressConferenceId");
    
    console.log("Found conferences:", approvedConferences.length);
    console.log("Conference statuses:", approvedConferences.map(c => ({ id: c.conferenceId, status: c.status })));

    // 3. Get conferences already handled by this reporter
    const handledConferenceIds = await ReporterConference.find({
      reporterId: reporterId
    }).distinct("conferenceId");

    // 4. Filter conferences based on admin targeting configuration
    const matchingConferences = approvedConferences.filter(conference => {
      // Skip if already handled
      if (handledConferenceIds.includes(conference.conferenceId)) {
        console.log(`Conference ${conference.conferenceId} already handled by reporter`);
        return false;
      }

      // Skip if reporter is explicitly excluded by admin
      if (conference.excludedReporters && conference.excludedReporters.length > 0) {
        const isExcluded = conference.excludedReporters.some(
          excludedId => excludedId.toString() === reporterId.toString()
        );
        if (isExcluded) {
          console.log(`Conference ${conference.conferenceId} - reporter ${reporterId} is excluded by admin`);
          return false;
        }
      }

      console.log(`Checking conference ${conference.conferenceId} for reporter ${reporterId} (${reporterState}, ${reporterCity})`);
      console.log(`Conference status: ${conference.status}`);

      // Add admin targeting information for modified conferences
      if (conference.status === "modified") {
        conference.adminTargeting = {
          allStates: conference.allStates,
          adminSelectState: conference.adminSelectState,
          adminSelectCities: conference.adminSelectCities,
          adminSelectPincode: conference.adminSelectPincode,
          reporterId: conference.reporterId,
          modifiedAt: conference.modifiedAt
        };
      }

      // Priority 1: Specific reporter selection
      if (conference.reporterId && conference.reporterId.length > 0) {
        const isSelectedReporter = conference.reporterId.includes(reporterId.toString());
        console.log(`Conference ${conference.conferenceId} has specific reporters:`, conference.reporterId);
        console.log(`Reporter ${reporterId} is selected: ${isSelectedReporter}`);
        return isSelectedReporter;
      }

      // Priority 2: All States flag
      if (conference.allStates === true) {
        console.log(`Conference ${conference.conferenceId} targets all states`);
        return true;
      }

      // Priority 3: Admin selected states and cities
      if (conference.adminSelectState && conference.adminSelectState.length > 0) {
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

      // Priority 4: Admin selected cities only
      if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
        const cityMatch = conference.adminSelectCities.includes(reporterCity);
        console.log(`Conference ${conference.conferenceId} has admin selected cities:`, conference.adminSelectCities);
        console.log(`City match: ${cityMatch}`);
        return cityMatch;
      }

      // Priority 5: Admin selected pincode
      if (conference.adminSelectPincode) {
        // This would require reporter's pincode, but we don't have that in the current user model
        // For now, skip pincode matching
        console.log(`Conference ${conference.conferenceId} has pincode targeting: ${conference.adminSelectPincode}`);
        return false;
      }

      // Priority 6: Default behavior - match by original state and city
      const defaultMatch = conference.state === reporterState && conference.city === reporterCity;
      console.log(`Default match for ${conference.conferenceId}: ${defaultMatch} (${conference.state} === ${reporterState} && ${conference.city} === ${reporterCity})`);
      return defaultMatch;
    });

    console.log(`Total conferences found: ${approvedConferences.length}`);
    console.log(`Matching conferences for reporter in ${reporterState}, ${reporterCity}: ${matchingConferences.length}`);
    console.log(`Handled conference IDs:`, handledConferenceIds);

    res.status(200).json({
      success: true,
      message: "New conferences fetched successfully",
      data: matchingConferences,
    });
  } catch (error) {
    console.error("Error fetching new conferences:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conferences",
    });
  }
};

// Get accepted conferences for reporter
const getAcceptedConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Get accepted conference records with stored conference details
    const acceptedConferences = await ReporterConference.find({
      reporterId: reporterId,
      status: "accepted"
    }).select("conferenceId iinsafId status acceptedAt rejectedAt rejectNote proofSubmitted proofDetails.adminRejectNote proofDetails.rejectedAt conferenceDetails");

    res.status(200).json({
      success: true,
      message: "Accepted conferences fetched successfully",
      data: acceptedConferences,
    });
  } catch (error) {
    console.error("Error fetching accepted conferences:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching accepted conferences",
    });
  }
};

// Get rejected conferences for reporter
const getRejectedConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Get rejected conference records with stored conference details
    const rejectedConferences = await ReporterConference.find({
      reporterId: reporterId,
      status: "rejected"
    });

    res.status(200).json({
      success: true,
      message: "Rejected conferences fetched successfully",
      data: rejectedConferences,
    });
  } catch (error) {
    console.error("Error fetching rejected conferences:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching rejected conferences",
    });
  }
};

// Get completed conferences for reporter
const getCompletedConferences = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Get completed conference records with stored conference details
    const completedConferences = await ReporterConference.find({
      reporterId: reporterId,
      status: "completed"
    });

    res.status(200).json({
      success: true,
      message: "Completed conferences fetched successfully",
      data: completedConferences,
    });
  } catch (error) {
    console.error("Error fetching completed conferences:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching completed conferences",
    });
  }
};

module.exports = {
  getNewConferences,
  getAcceptedConferences,
  getRejectedConferences,
  getCompletedConferences,
};
