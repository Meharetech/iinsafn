const RaiseYourVoice = require("../../models/raiseYourVoicePost/ryvPostSchema");
const raiseYourVoiceProof = require("../../models/raiseYourVoicePost/raiseYourVoiceProofSubmit")


// 1. Under Review
const getUnderReviewRaiseYourVoice = async (req, res) => {
  try {
    const userId = req.user._id; // logged-in user ID
    const records = await RaiseYourVoice.find({ userId, status: "under review" }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error("Error fetching under review records:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching under review records"
    });
  }
};

// 2. Approved
const getApprovedRaiseYourVoice = async (req, res) => {
  try {
    const userId = req.user._id;
    const records = await RaiseYourVoice.find({ userId, status: "approved" }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error("Error fetching approved records:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching approved records"
    });
  }
};

// 3. Rejected
const getRejectedRaiseYourVoice = async (req, res) => {
  try {
    const userId = req.user._id;
    const records = await RaiseYourVoice.find({ userId, status: "rejected" }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error("Error fetching rejected records:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching rejected records"
    });
  }
};



// 4. Running - Show accepted reporters and their work submissions
const getRunningRaiseYourVoice = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Find all ads created by this user
    const ads = await RaiseYourVoice.find({ userId })
      .sort({ createdAt: -1 });

    if (!ads || ads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No ads found for this user"
      });
    }

    // 2. Collect adIds
    const adIds = ads.map(ad => ad._id);

    // 3. Find all proofs (accepted, uploaded, running, completed) for these ads
    const allProofs = await raiseYourVoiceProof.find({
      adId: { $in: adIds },
      $or: [
        { status: "accepted" },    // Reporter accepted the voice post
        { proof: true },           // Reporter uploaded proof
        { status: "running" },    // Admin approved the proof
        { status: "completed" }    // Work completed
      ]
    })
      .populate("reporterId", "name email phoneNo iinsafId role")
      .sort({ createdAt: -1 });

    if (!allProofs || allProofs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No running ads found (no accepted reporters or uploaded proofs)"
      });
    }

    // 4. Group proofs by adId and create enhanced data structure
    const adsWithReporters = ads.map(ad => {
      const adProofs = allProofs.filter(
        proof => proof.adId.toString() === ad._id.toString()
      );

      if (adProofs.length > 0) {
        // Separate accepted and uploaded reporters
        const acceptedReporters = adProofs.filter(proof => proof.status === "accepted");
        const uploadedWork = adProofs.filter(proof => proof.proof === true);
        
        // Remove duplicates (a reporter can be both accepted and uploaded)
        const uniqueReporters = [];
        const processedIds = new Set();
        
        adProofs.forEach(proof => {
          const reporterId = proof.reporterId._id.toString();
          if (!processedIds.has(reporterId)) {
            processedIds.add(reporterId);
            uniqueReporters.push({
              ...proof.toObject(),
              hasAccepted: proof.status === "accepted",
              hasUploaded: proof.proof === true,
              adminStatus: proof.status, // running, completed, etc.
              // Add proper date fields
              acceptedAt: proof.status === "accepted" ? proof.createdAt : null,
              uploadedAt: proof.proof === true ? proof.createdAt : null,
              submittedAt: proof.createdAt // Always show when this proof was created
            });
          }
        });

        return {
          ...ad.toObject(),
          reporters: uniqueReporters,
          totalAccepted: acceptedReporters.length,
          totalUploaded: uploadedWork.length,
          totalReporters: uniqueReporters.length
        };
      }
      return null;
    }).filter(Boolean); // remove ads without any reporter activity

    res.status(200).json({
      success: true,
      count: adsWithReporters.length,
      data: adsWithReporters
    });

  } catch (error) {
    console.error("Error fetching running ads with reporter activity:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching running ads"
    });
  }
};



// 5. History - Show completed and approved posts with their completed work
const getHistoryRaiseYourVoice = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Find all ads created by this user
    const ads = await RaiseYourVoice.find({ userId })
      .sort({ createdAt: -1 });

    if (!ads || ads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No ads found for this user"
      });
    }

    // 2. Collect adIds
    const adIds = ads.map(ad => ad._id);

    // 3. Find completed proofs for these ads
    const completedProofs = await raiseYourVoiceProof.find({
      adId: { $in: adIds },
      status: "completed" // Only completed work
    })
      .populate("reporterId", "name email phoneNo iinsafId role")
      .sort({ createdAt: -1 });

    if (!completedProofs || completedProofs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No completed work found"
      });
    }

    // 4. Group proofs by adId and create enhanced data structure
    const adsWithCompletedWork = ads.map(ad => {
      const adProofs = completedProofs.filter(
        proof => proof.adId.toString() === ad._id.toString()
      );

      if (adProofs.length > 0) {
        // Remove duplicates (a reporter can have multiple completed proofs)
        const uniqueReporters = [];
        const processedIds = new Set();
        
        adProofs.forEach(proof => {
          const reporterId = proof.reporterId._id.toString();
          if (!processedIds.has(reporterId)) {
            processedIds.add(reporterId);
            uniqueReporters.push({
              ...proof.toObject(),
              hasAccepted: proof.status === "accepted",
              hasUploaded: proof.proof === true,
              adminStatus: proof.status, // completed
              // Add proper date fields
              acceptedAt: proof.status === "accepted" ? proof.createdAt : null,
              uploadedAt: proof.proof === true ? proof.createdAt : null,
              submittedAt: proof.createdAt,
              completedAt: proof.status === "completed" ? proof.createdAt : null
            });
          }
        });

        return {
          ...ad.toObject(),
          reporters: uniqueReporters,
          totalCompleted: adProofs.length,
          totalReporters: uniqueReporters.length
        };
      }
      return null;
    }).filter(Boolean); // remove ads without completed work

    res.status(200).json({
      success: true,
      count: adsWithCompletedWork.length,
      data: adsWithCompletedWork
    });

  } catch (error) {
    console.error("Error fetching history ads with completed work:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching history"
    });
  }
};

const getRaiseYourVoiceStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Count Under Review, Approved, Rejected directly from RaiseYourVoice
    const adStats = await RaiseYourVoice.aggregate([
      { $match: { userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // 2. Handle Running Ads separately (needs proofs with status "accepted" or "running")
    const userAds = await RaiseYourVoice.find({ userId }, "_id");
    const adIds = userAds.map(ad => ad._id);

    const runningProofs = await raiseYourVoiceProof.aggregate([
      { $match: { 
        adId: { $in: adIds }, 
        $or: [
          { status: "accepted" },
          { status: "running" },
          { proof: true } // Also include uploaded proofs
        ]
      }},
      { $group: { _id: "$adId" } } // unique ads with accepted/running/uploaded proofs
    ]);

    // 3. Handle Completed Ads (proofs with status "completed")
    const completedProofs = await raiseYourVoiceProof.aggregate([
      { $match: { adId: { $in: adIds }, status: "completed" } },
      { $group: { _id: "$adId" } } // unique ads with completed proofs
    ]);

    const stats = {
      underReview: 0,
      approved: 0,
      rejected: 0,
      running: runningProofs.length,
      completed: completedProofs.length
    };

    // Fill stats from adStats
    adStats.forEach(item => {
      if (item._id === "under review") stats.underReview = item.count;
      if (item._id === "approved") stats.approved = item.count;
      if (item._id === "rejected") stats.rejected = item.count;
    });

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("Error fetching RaiseYourVoice stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching RaiseYourVoice stats"
    });
  }
};



module.exports = {
  getUnderReviewRaiseYourVoice,
  getApprovedRaiseYourVoice,
  getRejectedRaiseYourVoice,
  getRunningRaiseYourVoice,
  getHistoryRaiseYourVoice,
  getRaiseYourVoiceStats
};
