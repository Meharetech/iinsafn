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

    // Check if all targeted reporters have responded (accepted/rejected)
    const FreeConference = require("../../../models/pressConference/freeConference");
    const conference = await FreeConference.findOne({ 
      conferenceId: reporterConference.conferenceId 
    });
    
    if (conference) {
      // Get all reporters who have responded to this conference (accepted or rejected)
      const allRespondedReporters = await ReporterConference.find({
        conferenceId: reporterConference.conferenceId,
        status: { $in: ["accepted", "rejected", "completed"] }
      });

      // Get all targeted reporters for this conference
      const User = require("../../../models/userModel/userModel");
      let totalTargetedReporters = 0;
      
      if (conference.reporterId && conference.reporterId.length > 0) {
        // Specific reporter targeting
        totalTargetedReporters = conference.reporterId.length;
      } else if (conference.allStates === true) {
        // All states targeting
        totalTargetedReporters = await User.countDocuments({
          role: "Reporter",
          verifiedReporter: true
        });
      } else if (conference.adminSelectState && conference.adminSelectState.length > 0) {
        // Admin selected states
        const query = {
          role: "Reporter",
          verifiedReporter: true,
          state: { $in: conference.adminSelectState }
        };
        
        if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
          query.city = { $in: conference.adminSelectCities };
        }
        
        totalTargetedReporters = await User.countDocuments(query);
      } else {
        // Default location-based targeting
        totalTargetedReporters = await User.countDocuments({
          role: "Reporter",
          verifiedReporter: true,
          state: conference.state,
          city: conference.city
        });
      }

      console.log(`Conference ${reporterConference.conferenceId} completion check:`, {
        totalTargetedReporters,
        respondedReporters: allRespondedReporters.length,
        allResponded: allRespondedReporters.map(r => ({ 
          reporterId: r.reporterId, 
          status: r.status 
        }))
      });

      // Only mark as completed when ALL targeted reporters have responded
      if (totalTargetedReporters > 0 && allRespondedReporters.length >= totalTargetedReporters) {
        // Check if all accepted reporters have completed their work
        const allAcceptedReporters = await ReporterConference.find({
          conferenceId: reporterConference.conferenceId,
          status: { $in: ["accepted", "completed"] }
        });

        const allCompletedReporters = await ReporterConference.find({
          conferenceId: reporterConference.conferenceId,
          status: "completed"
        });

        // Mark as completed only if all accepted reporters have completed their work
        if (allAcceptedReporters.length > 0 && allAcceptedReporters.length === allCompletedReporters.length) {
          if (conference.status === "approved" || conference.status === "modified") {
            conference.status = "completed";
            conference.completedAt = new Date();
            await conference.save();
            console.log(`Conference ${reporterConference.conferenceId} marked as completed - all targeted reporters responded and all accepted reporters completed their work`);
          }
        }
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
