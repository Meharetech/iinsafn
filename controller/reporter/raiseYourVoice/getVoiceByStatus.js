const RaiseYourVoice = require("../../../models/raiseYourVoicePost/ryvPostSchema");
const raiseYourVoiceProof = require("../../../models/raiseYourVoicePost/raiseYourVoiceProofSubmit");
const Admin = require("../../../models/adminModels/adminRegistration/adminSchema");
const sendEmail = require("../../../utils/sendEmail");

// Reporter/Influencer fetches all approved OR accepted ads
const getApprovedAdsForReporter = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // 1. Check user is verified
    if (!req.user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "You must be a verified user to access ads",
      });
    }

    // 2. Find all ads user already responded to
    const respondedProofs = await raiseYourVoiceProof.find({ reporterId: userId });
    const respondedAdIds = respondedProofs.map((p) => p.adId.toString());

    // 3. Fetch all "approved" OR "accepted" ads, except those already responded
    // Filter by targetUserType based on user role AND location targeting
    let query = {
      status: { $in: ["approved", "accepted"] }, // ✅ include both
      _id: { $nin: respondedAdIds }, // exclude already responded ads
    };

    // Filter by targetUserType based on user role
    if (userRole === "Reporter") {
      query.$or = [
        { targetUserType: "reporter" },
        { targetUserType: "both" }
      ];
    } else if (userRole === "Influencer") {
      query.$or = [
        { targetUserType: "influencer" },
        { targetUserType: "both" }
      ];
    }

    // Get all ads first
    let ads = await RaiseYourVoice.find(query).sort({ createdAt: -1 });
    
    // Filter by location targeting (adminSelectState/adminSelectCities)
    const userState = req.user.state;
    const userCity = req.user.city;
    
    console.log(`🔍 Filtering ads for user: ${req.user.name} (${userState}, ${userCity})`);
    
    ads = ads.filter(ad => {
      // If ad has admin targeting, check if user matches
      if (ad.adminSelectState && ad.adminSelectState.length > 0) {
        // If both states and cities are targeted
        if (ad.adminSelectCities && ad.adminSelectCities.length > 0) {
          const stateMatch = ad.adminSelectState.includes(userState);
          const cityMatch = ad.adminSelectCities.includes(userCity);
          console.log(`Ad ${ad._id}: State match (${userState} in ${ad.adminSelectState}): ${stateMatch}, City match (${userCity} in ${ad.adminSelectCities}): ${cityMatch}`);
          return stateMatch && cityMatch;
        }
        // If only states are targeted
        else {
          const stateMatch = ad.adminSelectState.includes(userState);
          console.log(`Ad ${ad._id}: State match (${userState} in ${ad.adminSelectState}): ${stateMatch}`);
          return stateMatch;
        }
      }
      // If ad has no admin targeting, show to all (original behavior)
      else {
        console.log(`Ad ${ad._id}: No admin targeting, showing to all users`);
        return true;
      }
    });
    
    console.log(`📊 Total ads after location filtering: ${ads.length}`);

    res.status(200).json({
      success: true,
      count: ads.length,
      data: ads,
    });
  } catch (error) {
    console.error("Error fetching ads for user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching ads",
    });
  }
};

// Reporter/Influencer accepts an ad
const reporterAcceptRyvAd = async (req, res) => {
  try {
    console.log("=== REPORTER ACCEPT RYV AD DEBUG ===");
    console.log("Request params:", req.params);
    console.log("Request body:", req.body);
    console.log("User from token:", req.user);
    
    const userId = req.user._id;
    const userIinsafId = req.user.iinsafId;
    const userRole = req.user.role;
    const { adId } = req.params;

    console.log("User ID:", userId);
    console.log("User IINSAF ID:", userIinsafId);
    console.log("User Role:", userRole);
    console.log("Ad ID:", adId);

    // Check if user is verified
    if (!req.user.isVerified) {
      console.log("User not verified:", req.user.isVerified);
      return res.status(403).json({
        success: false,
        message: "You must be a verified user to accept ads",
      });
    }

    // Check if user has valid role
    if (!userRole || (userRole !== "Reporter" && userRole !== "Influencer")) {
      console.log("Invalid user role:", userRole);
      return res.status(403).json({
        success: false,
        message: "Invalid user role. Only reporters and influencers can accept ads.",
      });
    }

    // Check if user has IINSAF ID
    if (!userIinsafId) {
      console.log("User missing IINSAF ID:", userIinsafId);
      return res.status(403).json({
        success: false,
        message: "You must have a valid IINSAF ID to accept ads",
      });
    }

    // Check if already responded
    console.log("Checking for existing proof...");
    const existingProof = await raiseYourVoiceProof.findOne({
      adId,
      reporterId: userId,
    });
    console.log("Existing proof found:", existingProof);
    
    if (existingProof) {
      return res
        .status(400)
        .json({ success: false, message: "You already responded to this ad" });
    }

    // Check if ad exists and user role matches targetUserType
    console.log("Looking for ad with ID:", adId);
    const ad = await RaiseYourVoice.findById(adId);
    console.log("Ad found:", ad);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

    console.log("Ad targetUserType:", ad.targetUserType);
    console.log("User role:", userRole);

    // Check if user role matches targetUserType
    if (userRole === "Reporter" && ad.targetUserType === "influencer") {
      console.log("Reporter trying to accept influencer-only ad");
      return res.status(403).json({
        success: false,
        message: "This ad is only for influencers",
      });
    }
    if (userRole === "Influencer" && ad.targetUserType === "reporter") {
      console.log("Influencer trying to accept reporter-only ad");
      return res.status(403).json({
        success: false,
        message: "This ad is only for reporters",
      });
    }

    // Create user acceptance record
    console.log("Creating acceptance record...");
    const acceptance = new raiseYourVoiceProof({
      adId,
      reporterId: userId,
      iinsafId: userIinsafId,
      status: "accepted",
      proof: false,
    });
    
    console.log("Saving acceptance record...");
    await acceptance.save();
    console.log("Acceptance record saved:", acceptance);

    // 🔑 If this is the first reporter, update ad status -> accepted
    console.log("Counting existing proofs for ad...");
    const proofCount = await raiseYourVoiceProof.countDocuments({ adId });
    console.log("Proof count:", proofCount);
    
    if (proofCount === 1) {
      console.log("First acceptance - updating ad status to accepted");
      await RaiseYourVoice.findByIdAndUpdate(adId, { status: "accepted" });
    }

    console.log("=== REPORTER ACCEPT SUCCESS ===");
    res.status(200).json({
      success: true,
      message: "You have accepted the ad successfully",
      acceptance,
    });
  } catch (error) {
    console.error("=== REPORTER ACCEPT ERROR ===");
    console.error("Error in reporterAcceptRyvAd:", error);
    console.error("Error stack:", error.stack);
    
    // Handle specific MongoDB duplicate key error
    if (error.code === 11000) {
      console.log("Duplicate key error detected - user may have already accepted this ad");
      return res.status(400).json({
        success: false,
        message: "You have already accepted this ad",
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reporter fetches all ads they accepted
const reporterGetAcceptedRyvAd = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Find all accepted proofs for this reporter
    const acceptedProofs = await raiseYourVoiceProof
      .find({ reporterId, status: "accepted" })
      .populate("adId"); // populate ad details

    if (!acceptedProofs.length) {
      return res.status(200).json({
        success: true,
        message: "You have not accepted any ads yet",
        ads: [],
      });
    }

    // Extract ads from proofs
    const ads = acceptedProofs.map((proof) => proof.adId);

    res.status(200).json({
      success: true,
      message: "Fetched accepted ads successfully",
      ads,
    });
  } catch (error) {
    console.error("Error in reporterGetAcceptedRyvAd:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reporter/Influencer rejects an ad
const reporterRejectRyvAd = async (req, res) => {
  try {
    const userId = req.user._id;
    const userIinsafId = req.user.iinsafId;
    const userRole = req.user.role;
    const { rejectionNote } = req.body;
    const { adId } = req.params;

    if (!rejectionNote || rejectionNote.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Rejection note is required" });
    }

    // Check if ad exists and user role matches targetUserType
    const ad = await RaiseYourVoice.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

    // Check if user role matches targetUserType
    if (userRole === "Reporter" && ad.targetUserType === "influencer") {
      return res.status(403).json({
        success: false,
        message: "This ad is only for influencers",
      });
    }
    if (userRole === "Influencer" && ad.targetUserType === "reporter") {
      return res.status(403).json({
        success: false,
        message: "This ad is only for reporters",
      });
    }

    // Check if already responded
    const existingProof = await raiseYourVoiceProof.findOne({
      adId,
      reporterId: userId,
    });
    if (existingProof) {
      return res
        .status(400)
        .json({ success: false, message: "You already responded to this ad" });
    }

    // Create proof record with rejected status
    const proof = new raiseYourVoiceProof({
      adId,
      reporterId: userId,
      iinsafId: userIinsafId,
      videoLink: "", // No proof needed
      platform: "",
      duration: "",
      status: "rejected",
      rejectionNote: rejectionNote.trim(),
    });

    await proof.save();

    res.status(200).json({
      success: true,
      message: "You have rejected the ad successfully",
      proof,
    });
  } catch (error) {
    console.error("Error in reporterRejectAd:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reporter submits proof (video link + platform + duration)
const submitReporterProof = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { videoLink, platform, duration, adId } = req.body;
    console.log("Data received for proof submission:", req.body);

    // 1. Validation
    if (!videoLink || !platform || !duration) {
      return res.status(400).json({
        success: false,
        message: "Video link, platform, and duration are required",
      });
    }

    // 2. Check if ad exists
    const ad = await RaiseYourVoice.findById(adId);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    if (ad.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Proof can only be submitted for approved or running ads",
      });
    }

    // 3. Find existing acceptance doc
    const proofDoc = await raiseYourVoiceProof.findOne({ adId, reporterId });
    if (!proofDoc) {
      return res.status(400).json({
        success: false,
        message: "You must accept the ad before submitting proof",
      });
    }

    if (proofDoc.proof) {
      return res.status(400).json({
        success: false,
        message: "Proof already submitted for this ad",
      });
    }

    // 4. Update proof data in proofDoc only
    proofDoc.videoLink = videoLink;
    proofDoc.platform = platform;
    proofDoc.duration = duration;
    proofDoc.proof = true;
    proofDoc.status = "running"; // <-- Update proof status instead of ad
    proofDoc.submittedAt = new Date();

    await proofDoc.save();

    console.log("Updated proofDoc:", proofDoc);

    // 🔔 Send notification to SuperAdmin + SubAdmins assigned to "Raise Your Voice"
    const admins = await Admin.find({
      $or: [
        { role: "superadmin" },
        { assignedSections: { $in: ["Raise Your Voice"] } }, // ✅ ensures multiple subadmins are included
      ],
    });

    for (const admin of admins) {
      await sendEmail(
        admin.email,
        "New Proof Submitted",
        `A reporter has submitted proof for Ad ID: ${adId}.
     Platform: ${platform}, Duration: ${duration}, Video: ${videoLink}.`
      );
    }

    res.status(200).json({
      success: true,
      message: "Proof submitted successfully",
      data: proofDoc,
    });
  } catch (error) {
    console.error("Error submitting reporter proof:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while submitting proof" });
  }
};

const updateProof = async (req, res) => {
  try {
    const { adId } = req.params;
    const reporterId = req.user._id; // reporter comes from auth middleware

    // 1. Find proof and ensure reporter owns it
    const proof = await raiseYourVoiceProof.findOne({
      adId: adId,
      reporterId: reporterId,
    });

    console.log("that is the proof for updation", proof);

    if (!proof) {
      return res.status(404).json({
        success: false,
        message: "Proof not found or not authorized",
      });
    }

    // 2. Reset proof fields back to initial state
    proof.videoLink = "";
    proof.platform = "";
    proof.duration = "";
    proof.status = "accepted"; // reset back to accepted
    proof.proof = false; // clear proof flag
    proof.rejectionNote = "";
    proof.reviewedAt = null; // clear review date

    await proof.save();

    // 🔹 Find relevant admins
    const admins = await Admin.find({
      $or: [
        { role: "superadmin" },
        { assignedSections: { $in: ["Raise Your Voice"] } },
      ],
    }).select("name email mobile");

    // 🔹 Notify Admins (Email + WhatsApp)
    for (const admin of admins) {
      // 📧 Email notification
      if (admin.email) {
        await sendEmail(
          admin.email,
          "Proof Re-uploaded",
          `Hello ${
            admin.name || "Admin"
          },\n\nReporter has re-uploaded proof for Ad ID: ${adId}. Please review the updated proof.`
        );
      }

      // 📱 WhatsApp notification
      if (admin.mobile) {
        await notifyOnWhatsapp(
          admin.mobile,
          Templates.NOTIFY_TO_ADMIN_AFTER_REUPLOAD_PROOF_OF_RYV_AD, // 👈 WhatsApp template name
          [
            admin.name || "Admin", // {{1}} -> Admin name
            adId, // {{2}} -> Ad ID
          ]
        );
      }
    }

    // 3. Send response
    res.status(200).json({
      success: true,
      message: "Proof reset successfully",
      data: proof,
    });

    console.log("that is another proof after updation", proof);
  } catch (error) {
    console.error("Error resetting proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resetting proof",
    });
  }
};

const getRejectedAdsForReporter = async (req, res) => {
  try {
    const reporterId = req.user._id; // reporter id comes from auth middleware

    // 1. Find all rejected proofs for this reporter
    const rejectedProofs = await raiseYourVoiceProof
      .find({
        reporterId,
        status: "rejected",
      })
      .sort({ createdAt: -1 });

    // console.log("Rejected proofs found:", rejectedProofs);

    if (!rejectedProofs.length) {
      return res.status(200).json({
        success: true,
        message: "No rejected ads found",
        data: [],
      });
    }

    // 2. Fetch ad details for each proof
    // const adIds = rejectedProofs.map(proof => proof.adId);
    // const ads = await RaiseYourVoice.find({ _id: { $in: adIds } });

    res.status(200).json({
      success: true,
      message: "Rejected ads fetched successfully",
      data: { proofs: rejectedProofs },
    });
  } catch (error) {
    console.error("Error fetching rejected ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching rejected ads",
    });
  }
};

// ✅ Get reporter's running RYV posts with proof uploaded
const getRunningRyvProofsForReporter = async (req, res) => {
  try {
    const reporterId = req.userId; // Assuming reporter ID comes from auth middleware

    const runningProofs = await raiseYourVoiceProof.find({
      reporterId,
      status: "running",
      proof: true,
    })
      .populate("adId", "description state city") // optional: populate ad details
      .select("adId videoLink platform duration status proof submittedAt iinsafId");

    if (!runningProofs.length) {
      return res.status(404).json({
        success: false,
        message: "No running RYV posts with proof uploaded found.",
      });
    }

    res.status(200).json({
      success: true,
      data: runningProofs,
    });
  } catch (error) {
    console.error("Error fetching running proofs for reporter:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



// ✅ Get reporter's completed RYV ads
const ReporterGetCompletedRyvProofs = async (req, res) => {
  try {
    const reporterId = req.userId; // reporter ID from auth middleware

    const completedProofs = await raiseYourVoiceProof.find({
      reporterId,
      status: "completed",
    })
      .populate("adId", "description state city") // optional: populate ad details
      .select("adId videoLink platform duration status proof iinsafId submittedAt reviewedAt");

    if (!completedProofs.length) {
      return res.status(404).json({
        success: false,
        message: "No completed RYV ads found for this reporter.",
      });
    }

    res.status(200).json({
      success: true,
      data: completedProofs,
    });
  } catch (error) {
    console.error("Error fetching completed RYV proofs for reporter:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// const getReporterRyvAdCounts = async (req, res) => {
//   try {
//     const reporterId = req.user._id;

//     // ✅ Count rejected
//     const rejectedCount = await raiseYourVoiceProof.countDocuments({
//       reporterId,
//       status: "rejected",
//     });

//     // ✅ Count accepted
//     const acceptedCount = await raiseYourVoiceProof.countDocuments({
//       reporterId,
//       status: "accepted",
//     });

//     // ✅ Count approved (new ads not yet responded to)
//     const respondedProofs = await raiseYourVoiceProof.find({ reporterId });
//     const respondedAdIds = respondedProofs.map((p) => p.adId.toString());

//     const approvedCount = await RaiseYourVoice.countDocuments({
//       status: { $in: ["approved", "accepted"] }, // ✅ include both
//       _id: { $nin: respondedAdIds },
//     });

//     res.status(200).json({
//       success: true,
//       message: "Reporter ads count fetched successfully",
//       data: {
//         approved: approvedCount,
//         accepted: acceptedCount,
//         rejected: rejectedCount,
//         total: approvedCount + acceptedCount + rejectedCount,
//       },
//     });
//   } catch (error) {
//     console.error("Error in getReporterAdCounts:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching reporter ad counts",
//       error: error.message,
//     });
//   }
// };



const getReporterRyvAdCounts = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // ✅ Count rejected
    const rejectedCount = await raiseYourVoiceProof.countDocuments({
      reporterId,
      status: "rejected",
    });

    // ✅ Count accepted
    const acceptedCount = await raiseYourVoiceProof.countDocuments({
      reporterId,
      status: "accepted",
    });

    // ✅ Count running (proof uploaded but still in progress)
    const runningCount = await raiseYourVoiceProof.countDocuments({
      reporterId,
      status: "running",
      proof: true,
    });

    // ✅ Count completed
    const completedCount = await raiseYourVoiceProof.countDocuments({
      reporterId,
      status: "completed",
    });

    // ✅ Count approved (new ads not yet responded to)
    const respondedProofs = await raiseYourVoiceProof.find({ reporterId });
    const respondedAdIds = respondedProofs.map((p) => p.adId.toString());

    const approvedCount = await RaiseYourVoice.countDocuments({
      status: { $in: ["approved", "accepted"] },
      _id: { $nin: respondedAdIds },
    });

    res.status(200).json({
      success: true,
      message: "Reporter ads count fetched successfully",
      data: {
        approved: approvedCount,
        accepted: acceptedCount,
        rejected: rejectedCount,
        running: runningCount,
        completed: completedCount,
        total:
          approvedCount +
          acceptedCount +
          rejectedCount +
          runningCount +
          completedCount,
      },
    });
  } catch (error) {
    console.error("Error in getReporterAdCounts:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reporter ad counts",
      error: error.message,
    });
  }
};


// Test endpoint to debug reporter accept functionality
const testReporterAccept = async (req, res) => {
  try {
    console.log("=== TEST REPORTER ACCEPT DEBUG ===");
    console.log("User from token:", req.user);
    console.log("User ID:", req.user._id);
    console.log("User Role:", req.user.role);
    console.log("User Verified:", req.user.isVerified);
    console.log("User IINSAF ID:", req.user.iinsafId);
    
    res.status(200).json({
      success: true,
      message: "Test endpoint working",
      user: {
        id: req.user._id,
        role: req.user.role,
        isVerified: req.user.isVerified,
        iinsafId: req.user.iinsafId
      }
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({ success: false, message: "Test endpoint error" });
  }
};

module.exports = {
  getApprovedAdsForReporter,
  submitReporterProof,
  reporterAcceptRyvAd,
  reporterRejectRyvAd,
  reporterGetAcceptedRyvAd,
  getRejectedAdsForReporter,
  updateProof,
  getRunningRyvProofsForReporter,
  ReporterGetCompletedRyvProofs,
  getReporterRyvAdCounts,
  testReporterAccept,
};
