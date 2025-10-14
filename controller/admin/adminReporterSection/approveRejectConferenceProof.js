const ReporterConference = require("../../../models/reporterConference/reporterConference");

const approveConferenceProof = async (req, res) => {
  try {
    const { conferenceId, reporterId } = req.params;
    const { adminNote } = req.body;

    // Find the reporter conference
    const reporterConference = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
      status: "accepted",
      proofSubmitted: true
    });

    if (!reporterConference) {
      return res.status(404).json({
        success: false,
        message: "Conference with submitted proof not found",
      });
    }

    // Update status to completed
    reporterConference.status = "completed";
    reporterConference.completedAt = new Date();
    if (adminNote) {
      reporterConference.adminNote = adminNote;
    }
    
    // Clear rejection note on approval
    if (reporterConference.proofDetails) {
      reporterConference.proofDetails.adminRejectNote = "";
      reporterConference.proofDetails.rejectedAt = null;
    }

    await reporterConference.save();

    // Check if all accepted reporters have completed their work
    const FreeConference = require("../../../models/pressConference/freeConference");
    // Get all reporters who were ever accepted (including those now completed)
    const allAcceptedReporters = await ReporterConference.find({
      conferenceId: reporterConference.conferenceId,
      status: { $in: ["accepted", "completed"] }
    });

    const allCompletedReporters = await ReporterConference.find({
      conferenceId: reporterConference.conferenceId,
      status: "completed"
    });

    // If all accepted reporters have completed their work, mark conference as completed
    if (allAcceptedReporters.length > 0 && allAcceptedReporters.length === allCompletedReporters.length) {
      const conference = await FreeConference.findOne({ 
        conferenceId: reporterConference.conferenceId 
      });
      
      if (conference && conference.status === "approved") {
        conference.status = "completed";
        conference.completedAt = new Date();
        await conference.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Conference proof approved successfully",
      data: {
        conferenceId: reporterConference.conferenceId,
        reporterId: reporterConference.reporterId,
        status: reporterConference.status,
        completedAt: reporterConference.completedAt,
      },
    });
  } catch (error) {
    console.error("Error approving conference proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while approving proof",
    });
  }
};

const rejectConferenceProof = async (req, res) => {
  try {
    const { conferenceId, reporterId } = req.params;
    const { rejectReason, adminRejectNote } = req.body;

    const rejectionNote = adminRejectNote || rejectReason;

    if (!rejectionNote) {
      return res.status(400).json({
        success: false,
        message: "Reject reason is required",
      });
    }

    // Find the reporter conference
    const reporterConference = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
      status: "accepted",
      proofSubmitted: true
    });

    if (!reporterConference) {
      return res.status(404).json({
        success: false,
        message: "Conference with submitted proof not found",
      });
    }

    // Reset proof submission status and add reject reason
    reporterConference.proofSubmitted = false;
    reporterConference.proofDetails = {
      ...reporterConference.proofDetails,
      rejectedAt: new Date(),
      rejectReason: rejectionNote,
      adminRejectNote: rejectionNote,
    };

    await reporterConference.save();

    res.status(200).json({
      success: true,
      message: "Conference proof rejected successfully",
      data: {
        conferenceId: reporterConference.conferenceId,
        reporterId: reporterConference.reporterId,
        proofSubmitted: reporterConference.proofSubmitted,
        rejectReason: rejectionNote,
        adminRejectNote: rejectionNote,
      },
    });
  } catch (error) {
    console.error("Error rejecting conference proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting proof",
    });
  }
};

// Get all conferences with submitted proofs for admin review
const getConferencesWithProofs = async (req, res) => {
  try {
    const conferences = await ReporterConference.find({
      status: "accepted",
      proofSubmitted: true
    }).populate("reporterId", "name email iinsafId state city");

    // Group by conferenceId
    const conferencesByConferenceId = {};
    conferences.forEach(conf => {
      if (!conferencesByConferenceId[conf.conferenceId]) {
        conferencesByConferenceId[conf.conferenceId] = [];
      }
      conferencesByConferenceId[conf.conferenceId].push(conf);
    });

    const result = Object.keys(conferencesByConferenceId).map(conferenceId => ({
      conferenceId,
      conferenceDetails: conferences[0].conferenceDetails,
      submittedProofs: conferencesByConferenceId[conferenceId].map(conf => ({
        reporterId: conf.reporterId._id,
        reporterName: conf.reporterId.name,
        reporterEmail: conf.reporterId.email,
        iinsafId: conf.iinsafId,
        reporterState: conf.reporterId.state,
        reporterCity: conf.reporterId.city,
        proofDetails: conf.proofDetails,
        submittedAt: conf.proofDetails.submittedAt,
        acceptedAt: conf.acceptedAt,
      })),
      totalProofs: conferencesByConferenceId[conferenceId].length,
    }));

    res.status(200).json({
      success: true,
      message: "Conferences with submitted proofs fetched successfully",
      data: result,
      totalConferences: result.length,
      totalProofs: conferences.length,
    });
  } catch (error) {
    console.error("Error fetching conferences with proofs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conferences with proofs",
    });
  }
};

module.exports = {
  approveConferenceProof,
  rejectConferenceProof,
  getConferencesWithProofs,
};
