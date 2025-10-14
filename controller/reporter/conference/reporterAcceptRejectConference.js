const FreeConference = require("../../../models/pressConference/freeConference");
const ReporterConference = require("../../../models/reporterConference/reporterConference");
const User = require("../../../models/userModel/userModel");

// Accept conference
const acceptConference = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const reporterIinsafId = req.user.iinsafId;
    const conferenceId = req.params.conferenceId;

    if (!conferenceId) {
      return res.status(400).json({
        success: false,
        message: "Conference ID is required",
      });
    }

    // 1. Check if conference exists and is approved/modified (only after admin approval)
    const conference = await FreeConference.findOne({ 
      conferenceId: conferenceId,
      status: { $in: ["approved", "modified"] }
    });
    
    console.log("Looking for conference:", conferenceId);
    console.log("Found conference:", conference ? { id: conference.conferenceId, status: conference.status } : "Not found");
    
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found or not approved",
      });
    }

    // 2. Check if reporter is verified
    const reporter = await User.findById(reporterId);
    if (!reporter || !reporter.verifiedReporter) {
      return res.status(403).json({
        success: false,
        message: "You are not a verified reporter",
      });
    }

    // 3. Check if already handled
    const existingEntry = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: "You have already responded to this conference",
      });
    }

    // 4. Create acceptance entry with complete conference details
    const reporterConference = new ReporterConference({
      conferenceId: conferenceId,
      reporterId: reporterId,
      iinsafId: reporterIinsafId,
      status: "accepted",
      acceptedAt: new Date(),
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
        adminNote: conference.adminNote,
        submittedBy: {
          name: conference.submittedBy?.name || "N/A",
          email: conference.submittedBy?.email || "N/A",
          organization: conference.submittedBy?.organization || "N/A",
          pressConferenceId: conference.submittedBy?.pressConferenceId || "N/A",
        },
      },
    });

    await reporterConference.save();

    res.status(200).json({
      success: true,
      message: "Conference accepted successfully",
      data: reporterConference,
    });
  } catch (error) {
    console.error("Error accepting conference:", error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already responded to this conference",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error while accepting conference",
    });
  }
};

// Reject conference
const rejectConference = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const reporterIinsafId = req.user.iinsafId;
    const conferenceId = req.params.conferenceId;
    const { rejectNote } = req.body;

    if (!conferenceId) {
      return res.status(400).json({
        success: false,
        message: "Conference ID is required",
      });
    }

    if (!rejectNote || rejectNote.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Rejection note is required",
      });
    }

    // 1. Check if conference exists and is approved/modified (only after admin approval)
    const conference = await FreeConference.findOne({ 
      conferenceId: conferenceId,
      status: { $in: ["approved", "modified"] }
    });
    
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found or not approved",
      });
    }

    // 2. Check if already handled
    const existingEntry = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: "You have already responded to this conference",
      });
    }

    // 3. Create rejection entry with complete conference details
    const reporterConference = new ReporterConference({
      conferenceId: conferenceId,
      reporterId: reporterId,
      iinsafId: reporterIinsafId,
      status: "rejected",
      rejectedAt: new Date(),
      rejectNote: rejectNote,
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
        adminNote: conference.adminNote,
        submittedBy: {
          name: conference.submittedBy?.name || "N/A",
          email: conference.submittedBy?.email || "N/A",
          organization: conference.submittedBy?.organization || "N/A",
          pressConferenceId: conference.submittedBy?.pressConferenceId || "N/A",
        },
      },
    });

    await reporterConference.save();

    res.status(200).json({
      success: true,
      message: "Conference rejected successfully",
      data: reporterConference,
    });
  } catch (error) {
    console.error("Error rejecting conference:", error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already responded to this conference",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error while rejecting conference",
    });
  }
};

module.exports = {
  acceptConference,
  rejectConference,
};
