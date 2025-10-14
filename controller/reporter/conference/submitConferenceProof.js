const ReporterConference = require("../../../models/reporterConference/reporterConference");

const submitConferenceProof = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const { videoLink, channelName, platform, duration } = req.body;
    const reporterId = req.user._id;
    
    // Get the uploaded file from multer
    const screenshot = req.file ? req.file.filename : null;
    
    console.log("Conference proof submission request:", {
      conferenceId,
      videoLink,
      channelName,
      platform,
      duration,
      screenshot,
      reporterId
    });

    // Validate required fields
    if (!videoLink) {
      return res.status(400).json({
        success: false,
        message: "Video link is required",
      });
    }

    if (!channelName) {
      return res.status(400).json({
        success: false,
        message: "Channel name is required",
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: "Platform is required",
      });
    }

    if (!duration) {
      return res.status(400).json({
        success: false,
        message: "Duration is required",
      });
    }

    // Validate YouTube URL format
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[\w-]+/;
    const isValidYouTubeUrl = youtubeRegex.test(videoLink);

    if (!isValidYouTubeUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid YouTube URL",
      });
    }

    // Find the reporter conference
    const reporterConference = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
      status: "accepted"
    });

    if (!reporterConference) {
      // Debug: Check if any record exists for this conference and reporter
      const anyRecord = await ReporterConference.findOne({
        conferenceId: conferenceId,
        reporterId: reporterId
      });
      
      console.log("Debug - Looking for conference:", {
        conferenceId,
        reporterId: reporterId.toString(),
        foundAccepted: !!reporterConference,
        foundAny: !!anyRecord,
        anyRecordStatus: anyRecord?.status
      });
      
      if (anyRecord) {
        return res.status(400).json({
          success: false,
          message: `Conference found but status is '${anyRecord.status}'. Only accepted conferences can submit proof.`,
        });
      }
      
      return res.status(404).json({
        success: false,
        message: "Accepted conference not found. Please make sure you have accepted this conference first.",
      });
    }

    // Check if proof already submitted and not rejected
    if (reporterConference.proofSubmitted && !reporterConference.proofDetails.adminRejectNote) {
      return res.status(400).json({
        success: false,
        message: "Proof already submitted for this conference",
      });
    }

    // Update proof details
    reporterConference.proofSubmitted = true;
    reporterConference.proofDetails = {
      channelName: channelName || "",
      platform: platform || "YouTube",
      videoLink: videoLink,
      duration: duration || "",
      screenshot: screenshot || "", // This will be the filename from multer
      submittedAt: new Date(),
      // Clear rejection note on resubmission
      adminRejectNote: "",
      rejectedAt: null,
    };

    await reporterConference.save();

    res.status(200).json({
      success: true,
      message: "Proof submitted successfully",
      data: {
        conferenceId: reporterConference.conferenceId,
        proofSubmitted: reporterConference.proofSubmitted,
        proofDetails: reporterConference.proofDetails,
      },
    });
  } catch (error) {
    console.error("Error submitting conference proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while submitting proof",
    });
  }
};

// Get proof details for a specific conference
const getConferenceProof = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const reporterId = req.user._id;

    const reporterConference = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
      status: "accepted"
    });

    if (!reporterConference) {
      return res.status(404).json({
        success: false,
        message: "Accepted conference not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Proof details fetched successfully",
      data: {
        proofSubmitted: reporterConference.proofSubmitted,
        proofDetails: reporterConference.proofDetails,
        conferenceDetails: reporterConference.conferenceDetails,
      },
    });
  } catch (error) {
    console.error("Error fetching conference proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching proof details",
    });
  }
};

module.exports = {
  submitConferenceProof,
  getConferenceProof,
};
