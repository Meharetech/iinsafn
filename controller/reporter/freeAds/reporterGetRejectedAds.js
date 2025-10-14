const FreeAdProof = require('../../../models/adminModels/freeAds/freeAdProofSchema');

const reporterGetRejectedAds = async (req, res) => {
  try {
    const reporterId = req.user._id; // Reporter ID from middleware

    // Find all proofs where status is rejected and belongs to this reporter
    const rejectedAds = await FreeAdProof.find({
      reporterId: reporterId,
      status: "rejected"
    })
    .populate("adId") // Populate ad details if needed
    .sort({ createdAt: -1 }); // Latest first

    if (!rejectedAds.length) {
      return res.status(404).json({
        success: false,
        message: "No rejected ads found."
      });
    }

    res.status(200).json({
      success: true,
      data: rejectedAds
    });

  } catch (error) {
    console.error("Error fetching rejected ads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = reporterGetRejectedAds;
