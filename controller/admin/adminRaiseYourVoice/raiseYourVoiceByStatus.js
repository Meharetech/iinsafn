const RaiseYourVoice = require("../../../models/raiseYourVoicePost/ryvPostSchema");
const RaiseYourVoiceProof = require("../../../models/raiseYourVoicePost/raiseYourVoiceProofSubmit");
const mongoose = require("mongoose");
const User = require("../../../models/userModel/userModel");
const ryvUser = require("../../../models/userModel/RaiseYourVoiceModel/raiseYourVoiceUsers");
const sendEmail = require("../../../utils/sendEmail");
const notifyOnWhatsapp = require("../../../utils/notifyOnWhatsapp");
const Templates = require("../../../utils/whatsappTemplates");
const notifyMatchingReporters = require("../../../utils/notifyMatchingReporters");

const getUnderReviewRyvAds = async (req, res) => {
  try {
    const { all } = req.query;
    
    let query = {};
    if (all !== 'true') {
      query = { status: "under review" };
    }
    
    const ads = await RaiseYourVoice.find(query).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, count: ads.length, data: ads });
  } catch (error) {
    console.error("Error fetching ads:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const approveRyvAd = async (req, res) => {
  try {
    const { adId } = req.params;

    const updatedAd = await RaiseYourVoice.findOneAndUpdate(
      { _id: adId, status: "under review" },
      {
        $set: {
          status: "approved",
          rejectionNote: "",
          approvedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedAd) {
      return res
        .status(404)
        .json({ success: false, message: "Ad not found or already reviewed" });
    }

    // 🔹 Send notification to post creator
    // await sendEmail({
    //   to: updatedAd.email,
    //   subject: "Your Raise Your Voice Post Has Been Approved ✅",
    //   text: `Hello ${updatedAd.name},\n\nYour Raise Your Voice post has been approved successfully.\n\nDescription: ${updatedAd.description}\n\nThank you for raising your voice!`,
    // });

    await sendEmail(
      updatedAd.email,
      "Your Raise Your Voice Post Has Been Approved ✅",
      `Hello ${updatedAd.name},\n\nYour Raise Your Voice post has been approved successfully.\n\nDescription: ${updatedAd.description}\n\nThank you for raising your voice!`,
      `<p>Hello <strong>${updatedAd.name}</strong>,</p><p>Your Raise Your Voice post has been approved successfully.</p><p><strong>Description:</strong> ${updatedAd.description}</p><p>Thank you for raising your voice!</p>` // HTML version
    );

    // 📱 WhatsApp notification to post creator
    if (updatedAd.phoneNo) {
      await notifyOnWhatsapp(
        updatedAd.phoneNo,
        Templates.NOTIFY_TO_USER_AFTER_APPROVE_RYV_AD, // 👈 WhatsApp template name
        [
          updatedAd.name, // {{1}} -> User name
          updatedAd.description, // {{2}} -> Post description
        ]
      );
    }

    // 🔔 Notify matching reporters/influencers based on targetUserType
    try {
      console.log("🔔 Notifying matching users for targetUserType:", updatedAd.targetUserType);
      
      if (updatedAd.targetUserType === "reporter") {
        // Notify only reporters
        const adForNotification = {
          ...updatedAd.toObject(),
          userType: "reporter",
          mediaDescription: updatedAd.description
        };
        await notifyMatchingReporters(adForNotification);
      } else if (updatedAd.targetUserType === "influencer") {
        // Notify only influencers
        const adForNotification = {
          ...updatedAd.toObject(),
          userType: "influencer",
          mediaDescription: updatedAd.description
        };
        await notifyMatchingReporters(adForNotification);
      } else if (updatedAd.targetUserType === "both") {
        // Notify both reporters and influencers
        const adForReporter = {
          ...updatedAd.toObject(),
          userType: "reporter",
          mediaDescription: updatedAd.description
        };
        const adForInfluencer = {
          ...updatedAd.toObject(),
          userType: "influencer",
          mediaDescription: updatedAd.description
        };
        
        await Promise.all([
          notifyMatchingReporters(adForReporter),
          notifyMatchingReporters(adForInfluencer)
        ]);
      }
      
      console.log("✅ Notifications sent to matching users");
    } catch (notificationError) {
      console.error("❌ Error sending notifications to users:", notificationError);
      // Don't fail the approval if notifications fail
    }

    res.status(200).json({
      success: true,
      message: "Ad approved successfully",
      data: updatedAd,
    });
  } catch (error) {
    console.error("Error approving ad:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const rejectRyvAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const { rejectionNote } = req.body;

    const updatedAd = await RaiseYourVoice.findOneAndUpdate(
      { _id: adId, status: "under review" },
      { $set: { status: "rejected", rejectionNote: rejectionNote || "" } },
      { new: true }
    );

    if (!updatedAd) {
      return res
        .status(404)
        .json({ success: false, message: "Ad not found or already reviewed" });
    }

    // 📧 Email notification to post creator
    await sendEmail({
      to: updatedAd.email,
      subject: "Your Raise Your Voice Post Has Been Rejected ❌",
      text: `Hello ${
        updatedAd.name
      },\n\nUnfortunately, your Raise Your Voice post has been rejected.\n\nReason: ${
        updatedAd.rejectionNote || "No reason provided."
      }\n\nDescription: ${
        updatedAd.description
      }\n\nYou can create another one post.\n\nThank you for understanding.`,
    });

    // 📱 WhatsApp notification to post creator
    if (updatedAd.phoneNo) {
      await notifyOnWhatsapp(
        updatedAd.phoneNo,
        Templates.NOTIFY_TO_USER_AFTER_REJECTED_RYV_AD, // 👈 WhatsApp template name
        [
          updatedAd.name, // {{1}} -> User name
          updatedAd.rejectionNote || "No reason provided.", // {{2}} -> Rejection reason
          updatedAd.description, // {{3}} -> Post description
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: "Ad rejected successfully",
      data: updatedAd,
    });
  } catch (error) {
    console.error("Error rejecting ad:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getApprovedRyvAds = async (req, res) => {
  try {
    const ads = await RaiseYourVoice.find({ status: "approved" }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, count: ads.length, data: ads });
  } catch (error) {
    console.error("Error fetching approved ads:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ✅ Get all accepted RYV proofs
const getAcceptedRyvProofs = async (req, res) => {
  try {
    // Fetch all proofs where status is 'accepted' and group by adId
    const acceptedProofs = await RaiseYourVoiceProof.find({ status: "accepted" })
      .populate("adId", "description state city targetUserType") // populate ad details including targetUserType
      .populate("reporterId", "name email phoneNo iinsafId role"); // populate reporter details with role

    if (!acceptedProofs.length) {
      return res.status(404).json({
        success: false,
        message: "No accepted RYV proofs found.",
      });
    }

    // Group proofs by adId to create single entries per ad
    const groupedProofs = {};
    
    acceptedProofs.forEach(proof => {
      const adId = proof.adId._id.toString();
      
      if (!groupedProofs[adId]) {
        // Create new grouped entry for this ad
        groupedProofs[adId] = {
          _id: proof._id, // Use the first proof's ID as the main ID
          adId: proof.adId,
          acceptedUsers: [],
          totalAccepted: 0,
          createdAt: proof.createdAt,
          updatedAt: proof.updatedAt
        };
      }
      
      // Add this user to the accepted users list
      groupedProofs[adId].acceptedUsers.push({
        _id: proof.reporterId._id,
        name: proof.reporterId.name,
        email: proof.reporterId.email,
        phoneNo: proof.reporterId.phoneNo,
        iinsafId: proof.reporterId.iinsafId,
        role: proof.reporterId.role,
        acceptedAt: proof.createdAt,
        proofId: proof._id
      });
      
      groupedProofs[adId].totalAccepted++;
    });

    // Convert grouped object to array
    const groupedArray = Object.values(groupedProofs);

    res.status(200).json({
      success: true,
      count: groupedArray.length,
      data: groupedArray,
    });
  } catch (error) {
    console.error("Error fetching accepted RYV proofs:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getRunningRyvAds = async (req, res) => {
  try {
    // Get all accepted proofs (reporter accepted the voice post)
    const acceptedProofs = await RaiseYourVoiceProof.find({
      status: "accepted", // Reporter has accepted the voice post
    })
      .populate("adId", "description state city targetUserType") // populate ad details
      .populate("reporterId", "name email phoneNo iinsafId role"); // populate reporter details

    // Get all proofs with uploaded content (proof: true)
    const uploadedProofs = await RaiseYourVoiceProof.find({
      proof: true, // Reporter has uploaded proof
    })
      .populate("adId", "description state city targetUserType") // populate ad details
      .populate("reporterId", "name email phoneNo iinsafId role"); // populate reporter details

    // Combine both types of proofs
    const allProofs = [...acceptedProofs, ...uploadedProofs];

    if (!allProofs.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No RYV posts with accepted reporters or uploaded proofs found.",
      });
    }

    // Group proofs by adId to create single entries per ad
    const groupedProofs = {};
    
    allProofs.forEach(proof => {
      const adId = proof.adId._id.toString();
      
      if (!groupedProofs[adId]) {
        // Create new grouped entry for this ad
        groupedProofs[adId] = {
          _id: proof._id, // Use the first proof's ID as the main ID
          adId: proof.adId,
          acceptedUsers: [],
          uploadedUsers: [],
          totalAccepted: 0,
          totalUploaded: 0,
          createdAt: proof.createdAt,
          updatedAt: proof.updatedAt
        };
      }
      
      // Check if this is an accepted proof (reporter accepted the voice post)
      if (proof.status === "accepted") {
        // Check if this reporter is already in acceptedUsers (avoid duplicates)
        const existingAccepted = groupedProofs[adId].acceptedUsers.find(
          user => user._id.toString() === proof.reporterId._id.toString()
        );
        
        if (!existingAccepted) {
          // Add to accepted users list
          groupedProofs[adId].acceptedUsers.push({
            _id: proof.reporterId._id,
            name: proof.reporterId.name,
            email: proof.reporterId.email,
            phoneNo: proof.reporterId.phoneNo,
            iinsafId: proof.reporterId.iinsafId,
            role: proof.reporterId.role,
            acceptedAt: proof.createdAt,
            proofId: proof._id,
            hasUploadedProof: proof.proof || false,
            // Add fields that frontend expects for the table
            reporterId: proof.reporterId,
            submittedAt: proof.createdAt,
            videoLink: proof.videoLink || null,
            platform: proof.platform || null,
            duration: proof.duration || null
          });
          groupedProofs[adId].totalAccepted++;
        }
      }
      
      // Check if this is an uploaded proof (reporter uploaded content)
      if (proof.proof === true) {
        // Check if this reporter is already in uploadedUsers (avoid duplicates)
        const existingUploaded = groupedProofs[adId].uploadedUsers.find(
          user => user._id.toString() === proof.reporterId._id.toString()
        );
        
        if (!existingUploaded) {
          // Add to uploaded users list
          groupedProofs[adId].uploadedUsers.push({
            _id: proof.reporterId._id,
            name: proof.reporterId.name,
            email: proof.reporterId.email,
            phoneNo: proof.reporterId.phoneNo,
            iinsafId: proof.reporterId.iinsafId,
            role: proof.reporterId.role,
            uploadedAt: proof.createdAt,
            proofId: proof._id,
            status: proof.status, // "accepted", "running", etc.
            // Add fields that frontend expects for the table
            reporterId: proof.reporterId,
            submittedAt: proof.createdAt,
            videoLink: proof.videoLink || null,
            platform: proof.platform || null,
            duration: proof.duration || null
          });
          groupedProofs[adId].totalUploaded++;
        }
      }
    });

    // Convert grouped object to array
    const groupedArray = Object.values(groupedProofs);

    res.status(200).json({
      success: true,
      count: groupedArray.length,
      data: groupedArray,
    });
  } catch (error) {
    console.error("Error fetching running ads:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const adminAcceptTheProof = async (req, res) => {
  try {
    const { adId, reporterId } = req.params;

    console.log(
      "Admin is accepting proof for Ad ID:",
      adId,
      "and Reporter ID:",
      reporterId
    );

    // validate IDs first
    if (
      !mongoose.Types.ObjectId.isValid(adId) ||
      !mongoose.Types.ObjectId.isValid(reporterId)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid adId or reporterId" });
    }

    // 🔍 Find proof
    const proof = await RaiseYourVoiceProof.findOne({
      adId: new mongoose.Types.ObjectId(adId),
      reporterId: new mongoose.Types.ObjectId(reporterId),
    }).populate("reporterId", "name email mobile");

    if (!proof) {
      return res.status(404).json({
        success: false,
        message: "Proof not found for this reporter and ad",
      });
    }

    if (proof.status !== "running" || proof.proof !== true) {
      return res.status(400).json({
        success: false,
        message: "Proof is not in running state or not submitted properly",
      });
    }

    // ✅ Update proof status
    proof.status = "completed";
    proof.reviewedAt = new Date();
    await proof.save();

    // ✅ Update RaiseYourVoice status
    await RaiseYourVoice.findByIdAndUpdate(
      adId,
      { $set: { status: "completed" } },
      { new: true }
    );

    // ✉️ Notify Reporter
    if (proof.reporterId?.email) {
      await sendEmail({
        to: proof.reporterId.email,
        subject: "Your Proof Has Been Accepted ✅",
        text: `Hello ${proof.reporterId.name},\n\nGood news! Your submitted proof for Ad ID: ${adId} has been accepted by the admin.\n\nThank you for your work!`,
      });
    }

    // 📱 WhatsApp Notification
    if (proof?.reporterId?.mobile) {
      await notifyOnWhatsapp(
        proof.reporterId.mobile,
        Templates.NOTIFY_TO_REPORTER_AFTER_APPROVE_RYV_AD_PROOF,
        [
          proof.reporterId.name, // {{1}}
          adId, // {{2}}
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: "Proof accepted successfully & ad marked completed",
      data: proof,
    });
  } catch (error) {
    console.error("🔥 Error in adminAcceptTheProof:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while accepting proof" });
  }
};

// ✅ Admin rejects the proof
const adminRejectTheProof = async (req, res) => {
  try {
    let { proofId } = req.params;
    const { rejectionNote } = req.body;

    // Force string in case proofId is accidentally an object
    if (typeof proofId !== "string") {
      proofId = proofId.toString();
    }

    console.log("Rejecting Proof with ID:", proofId);
    console.log("Rejection Note:", rejectionNote);

    const updatedProof = await RaiseYourVoiceProof.findByIdAndUpdate(
      proofId,
      {
        $set: {
          status: "rejected",
          rejectionNote: rejectionNote,
        },
      },
      { new: true }
    );

    if (!updatedProof) {
      return res.status(404).json({
        success: false,
        message: "Proof not found",
      });
    }

    if (updatedProof.reporterId?.email) {
      // 📧 Email Notification
      await sendEmail({
        to: updatedProof.reporterId.email,
        subject: "Your Proof Has Been Rejected ❌",
        text: `Hello ${
          updatedProof.reporterId.name
        },\n\nUnfortunately, your submitted proof for Ad ID: ${
          updatedProof.adId
        } has been rejected.\n\nReason: ${
          rejectionNote || "No reason provided"
        }.\n\nPlease review and try again.`,
      });
    }

    // 📱 WhatsApp Notification
    if (updatedProof.reporterId?.mobile) {
      await notifyOnWhatsapp(
        updatedProof.reporterId.mobile,
        Templates.NOTIFY_TO_REPORTER_AFTER_REJECT_RYV_AD_PROOF, // 👈 WhatsApp template name
        [
          updatedProof.reporterId.name, // {{1}} -> Reporter name
          updatedProof.adId, // {{2}} -> Ad ID
          rejectionNote || "No reason provided", // {{3}} -> Rejection reason
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: "Proof rejected successfully",
      proof: updatedProof,
    });
  } catch (error) {
    console.error("Error rejecting proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting proof",
      error: error.message,
    });
  }
};

const adminGetRejectedProofs = async (req, res) => {
  try {
    // const { adId } = req.params;

    // 1. Get all proofs of this ad where status = rejected
    const proofs = await RaiseYourVoiceProof.find({
      status: "rejected",
    })
      .populate("adId", "description state city targetUserType") // populate ad details including targetUserType
      .populate("reporterId", "name email mobile") // optional: get reporter info
      .sort({ createdAt: -1 });

    if (!proofs || proofs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No rejected proofs found",
      });
    }

    res.status(200).json({
      success: true,
      count: proofs.length,
      data: proofs,
    });
  } catch (error) {
    console.error("Error fetching rejected proofs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching rejected proofs",
    });
  }
};


const getRyvAdsStatsForAdmin = async (req, res) => {
  try {
    // 1️⃣ Count directly from RaiseYourVoice (ads collection)
    const adStats = await RaiseYourVoice.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // 2️⃣ Count running ads (unique adIds) from proofs with accepted/running/uploaded status
    const runningProofs = await RaiseYourVoiceProof.aggregate([
      { 
        $match: { 
          $or: [
            { status: "accepted" },
            { status: "running" },
            { proof: true }
          ]
        } 
      },
      {
        $group: {
          _id: "$adId", // group by adId only
        },
      },
      {
        $count: "runningCount"
      }
    ]);

    // 3️⃣ Count completed ads (unique adIds) from proofs with completed status
    const completedProofs = await RaiseYourVoiceProof.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$adId", // group by adId only
        },
      },
      {
        $count: "completedCount"
      }
    ]);

    // 3️⃣ Fetch all accepted proofs with reporter info
    const acceptedProofs = await RaiseYourVoiceProof.find({ status: "accepted" })
      .populate("adId", "description state city") // ad details
      .populate("reporterId", "name email phoneNo iinsafId"); // reporter details

    // 4️⃣ Initialize stats
    const stats = {
      underReview: 0,
      approved: 0,
      rejected: 0,
      modified: 0,
      running: runningProofs.length > 0 ? runningProofs[0].runningCount : 0,
      completed: completedProofs.length > 0 ? completedProofs[0].completedCount : 0,
      acceptedByReporter: acceptedProofs.length, // number of accepted proofs
    };

    // Fill stats from ads
    adStats.forEach((item) => {
      if (item._id === "under review") stats.underReview = item.count;
      if (item._id === "approved") stats.approved = item.count;
      if (item._id === "rejected") stats.rejected = item.count;
      if (item._id === "modified") stats.modified = item.count;
    });

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error fetching RaiseYourVoice stats for admin:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching stats",
    });
  }
};


const adminGetRyvPostHistory = async (req, res) => {
  try {
    console.log("=== ADMIN GET RYV POST HISTORY ===");
    
    const history = await RaiseYourVoiceProof.find()
      .populate({
        path: "adId", // link to ryvPost
        model: "ryvPost",
        populate: {
          path: "userId", // link to ryvUser
          model: "ryvUser",
          select: "name email phoneNo state city", // only required fields
        },
      })
      .populate({
        path: "reporterId", // if reporter exists
        select: "name email phoneNo iinsafId",
      })
      .lean();

    console.log("Found history records:", history.length);
    console.log("History data sample:", history[0]);

    res.status(200).json({
      success: true,
      message: "Raise Your Voice post history fetched successfully",
      count: history.length,
      history,
    });
  } catch (error) {
    console.error("🔥 Error fetching RYV post history:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching RYV post history",
    });
  }
};

// ✅ Get all completed RYV ads
const getCompletedRyvAds = async (req, res) => {
  try {
    // Fetch all completed raise your voice posts
    const completedAds = await RaiseYourVoice.find({ status: "completed" })
      .populate("userId", "name email phoneNo")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: completedAds.length,
      data: completedAds,
    });
  } catch (error) {
    console.error("Error fetching completed RYV ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching completed ads",
    });
  }
};

// Modify Raise Your Voice post with admin targeting
const modifyRyvAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const {
      adminSelectState,
      adminSelectCities,
      adminSelectPincode,
      reporterId,
      allStates,
      note
    } = req.body;

    const ad = await RaiseYourVoice.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Raise Your Voice post not found"
      });
    }

    // Update admin targeting fields
    ad.adminSelectState = adminSelectState || [];
    ad.adminSelectCities = adminSelectCities || [];
    ad.adminSelectPincode = adminSelectPincode || "";
    ad.reporterId = reporterId || [];
    ad.allStates = allStates || false;
    ad.status = "modified";
    ad.modifiedAt = new Date();

    // Update admin action tracking
    ad.adminAction = {
      action: "modified",
      note: note || "",
      modifiedBy: req.admin?.id,
      actionDate: new Date()
    };

    await ad.save();

    // Clear rejection status for reporters when resending (modified action)
    try {
      if (reporterId && reporterId.length > 0) {
        // Clear rejection status for specific selected reporters
        console.log(`🔄 Clearing rejection status for ${reporterId.length} selected reporters`);
        
        const updateResult = await RaiseYourVoiceProof.updateMany(
          {
            adId: ad._id,
            reporterId: { $in: reporterId },
            status: "rejected"
          },
          {
            $set: {
              status: "pending",
              rejectionNote: ""
            },
            $unset: {
              reviewedAt: 1
            }
          }
        );
        
        console.log(`✅ Cleared rejection status for ${updateResult.modifiedCount} selected reporters`);
      } else {
        // Clear rejection status for all reporters in this post
        console.log(`🔄 Clearing rejection status for all reporters in post ${ad._id}`);
        
        const updateResult = await RaiseYourVoiceProof.updateMany(
          {
            adId: ad._id,
            status: "rejected"
          },
          {
            $set: {
              status: "pending",
              rejectionNote: ""
            },
            $unset: {
              reviewedAt: 1
            }
          }
        );
        
        console.log(`✅ Cleared rejection status for ${updateResult.modifiedCount} all reporters`);
      }
      
    } catch (clearRejectionError) {
      console.error(`❌ Error clearing rejection status:`, clearRejectionError);
      // Don't fail the request if clearing rejection fails
    }

    // Notify matching reporters/influencers
    await notifyMatchingReporters(ad);

    // Notify the original poster
    const poster = await ryvUser.findById(ad.userId);
    if (poster) {
      await sendEmail(
        poster.email,
        "✅ Your Raise Your Voice Post Has Been Modified",
        `Hello ${poster.name},\n\nYour Raise Your Voice post has been modified and approved by admin.\n\nDescription: ${ad.description}\n\nAdmin Note: ${note || "No additional notes"}\n\nThank you for raising your voice!`
      );

      // WhatsApp notification
      await notifyOnWhatsapp(
        poster.phoneNo,
        Templates.NOTIFY_TO_USER_AFTER_APPROVE_RYV_AD,
        [poster.name, ad.description]
      );
    }

    res.status(200).json({
      success: true,
      message: "Raise Your Voice post modified successfully",
      data: {
        adId: ad._id,
        status: ad.status,
        adminAction: ad.adminAction
      }
    });

  } catch (error) {
    console.error("Error modifying Raise Your Voice post:", error);
    res.status(500).json({
      success: false,
      message: "Server error while modifying post"
    });
  }
};

// Get single Raise Your Voice post by ID
const getSingleRyvAd = async (req, res) => {
  try {
    const { adId } = req.params;
    
    const ad = await RaiseYourVoice.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Raise Your Voice post not found"
      });
    }

    res.status(200).json({
      success: true,
      data: ad
    });
  } catch (error) {
    console.error("Error fetching single RYV ad:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching post"
    });
  }
};

// Get all Raise Your Voice posts (for admin to see all statuses)
const getAllRyvAds = async (req, res) => {
  try {
    const ads = await RaiseYourVoice.find({}).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: ads.length,
      data: ads
    });
  } catch (error) {
    console.error("Error fetching all RYV ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching posts"
    });
  }
};

// Get all reporters who have the Raise Your Voice post in their panel (targeted reporters)
const getRyvPostTargetedReporters = async (req, res) => {
  try {
    const { postId } = req.params;
    
    console.log(`📋 Getting all targeted users for Raise Your Voice post ${postId}`);
    
    // Find the post
    const post = await RaiseYourVoice.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Raise Your Voice post not found",
      });
    }
    
    console.log(`🔍 Raise Your Voice Post status: ${post.status}`);
    console.log(`🔍 Raise Your Voice Post targetUserType: ${post.targetUserType}`);
    console.log(`🔍 Raise Your Voice Post targeting:`, {
      allStates: post.allStates,
      adminSelectState: post.adminSelectState,
      adminSelectCities: post.adminSelectCities,
      reporterId: post.reporterId,
      originalState: post.state,
      originalCity: post.city
    });
    
    // Find ALL users who have ever been targeted for this post
    const User = require("../../../models/userModel/userModel");
    let allTargetedReporters = new Set(); // Use Set to avoid duplicates
    let allTargetedInfluencers = new Set(); // Use Set to avoid duplicates
    
    // Get all responses to see which users have been targeted
    const RaiseYourVoiceInfluencerProof = require("../../../models/raiseYourVoicePost/raiseYourVoiceInfluencerProofSubmit");
    
    const existingReporterResponses = await RaiseYourVoiceProof.find({ adId: postId })
      .populate("reporterId", "name email mobile iinsafId state city");
    
    const existingInfluencerResponses = await RaiseYourVoiceInfluencerProof.find({ adId: postId })
      .populate("influencerId", "name email mobile iinsafId state city");
    
    // Add reporters from existing responses
    existingReporterResponses.forEach(response => {
      if (response.reporterId) {
        allTargetedReporters.add(response.reporterId._id.toString());
        console.log(`📋 Added historical reporter: ${response.reporterId.name} (${response.reporterId._id})`);
      }
    });
    
    // Add influencers from existing responses
    existingInfluencerResponses.forEach(response => {
      if (response.influencerId) {
        allTargetedInfluencers.add(response.influencerId._id.toString());
        console.log(`📋 Added historical influencer: ${response.influencerId.name} (${response.influencerId._id})`);
      }
    });
    
    console.log(`📋 Found ${existingReporterResponses.length} existing reporter responses`);
    console.log(`📋 Found ${existingInfluencerResponses.length} existing influencer responses`);
    console.log(`📋 Historical reporters count: ${allTargetedReporters.size}`);
    console.log(`📋 Historical influencers count: ${allTargetedInfluencers.size}`);
    
    // Determine which user types to target based on targetUserType
    const shouldTargetReporters = post.targetUserType === "reporter" || post.targetUserType === "both";
    const shouldTargetInfluencers = post.targetUserType === "influencer" || post.targetUserType === "both";
    
    console.log(`🎯 Should target reporters: ${shouldTargetReporters}`);
    console.log(`🎯 Should target influencers: ${shouldTargetInfluencers}`);
    
    // DEBUG: Check if there are any influencers in the database
    const totalInfluencers = await User.countDocuments({ role: "Influencer" });
    const verifiedInfluencers = await User.countDocuments({ role: "Influencer", isVerified: true });
    console.log(`🔍 DEBUG: Total influencers in database: ${totalInfluencers}`);
    console.log(`🔍 DEBUG: Verified influencers in database: ${verifiedInfluencers}`);
    
    // DEBUG: Check if there are any influencers in the same state/city as the post
    const influencersInSameLocation = await User.countDocuments({ 
      role: "Influencer", 
      isVerified: true,
      state: post.state,
      city: post.city
    });
    console.log(`🔍 DEBUG: Verified influencers in ${post.state}, ${post.city}: ${influencersInSameLocation}`);
    
    // TARGET REPORTERS
    if (shouldTargetReporters) {
      console.log(`📰 Targeting reporters...`);
      
      // CRITICAL: Always add CURRENT targeting reporters (not just historical responses)
      // This ensures we show ALL reporters who should have the post in their panel
      let currentTargetReporters = [];
      
      if (post.reporterId && post.reporterId.length > 0) {
        // Specific reporter selection
        currentTargetReporters = await User.find({
          _id: { $in: post.reporterId },
          role: "Reporter",
          verifiedReporter: true
        }).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetReporters.length} currently selected reporters`);
      } else if (post.allStates === true) {
        // All states
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true
        }).select("name email mobile iinsafId state city");
        console.log(`🌍 Found ${currentTargetReporters.length} reporters (all states)`);
      } else if (post.adminSelectState && post.adminSelectState.length > 0) {
        // Admin selected states
        const query = {
          role: "Reporter",
          verifiedReporter: true,
          state: { $in: post.adminSelectState }
        };
        
        if (post.adminSelectCities && post.adminSelectCities.length > 0) {
          query.city = { $in: post.adminSelectCities };
        }
        
        currentTargetReporters = await User.find(query).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetReporters.length} reporters in selected states/cities`);
      } else if (post.adminSelectCities && post.adminSelectCities.length > 0) {
        // Admin selected cities
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true,
          city: { $in: post.adminSelectCities }
        }).select("name email mobile iinsafId state city");
        console.log(`🏙️ Found ${currentTargetReporters.length} reporters in selected cities`);
      } else {
        // Default behavior - match by original state and city
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true,
          state: post.state,
          city: post.city
        }).select("name email mobile iinsafId state city");
        console.log(`📍 Found ${currentTargetReporters.length} reporters in original location`);
      }
      
      // Add current targeting reporters to the set
      currentTargetReporters.forEach(reporter => {
        allTargetedReporters.add(reporter._id.toString());
        console.log(`🎯 Added current targeting reporter: ${reporter.name} (${reporter._id})`);
      });
      
      // For modified posts, also add ORIGINAL default targeting (state/city based)
      if (post.status === "modified") {
        console.log(`🔄 Raise Your Voice Post is MODIFIED - also adding original default targeting for reporters`);
        
        // Add ORIGINAL default targeting (state/city based)
        const originalTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true,
          state: post.state,
          city: post.city
        }).select("name email mobile iinsafId state city");
        
        originalTargetReporters.forEach(reporter => {
          allTargetedReporters.add(reporter._id.toString());
          console.log(`📍 Added ORIGINAL default reporter: ${reporter.name} (${reporter._id})`);
        });
        
        console.log(`📍 Added ${originalTargetReporters.length} original default reporters`);
      }
    }
    
    // TARGET INFLUENCERS
    if (shouldTargetInfluencers) {
      console.log(`🌟 Targeting influencers...`);
      
      // CRITICAL: Always add CURRENT targeting influencers
      // This ensures we show ALL influencers who should have the post in their panel
      let currentTargetInfluencers = [];
      
      if (post.reporterId && post.reporterId.length > 0) {
        // Specific influencer selection (using same field for now)
        currentTargetInfluencers = await User.find({
          _id: { $in: post.reporterId },
          role: "Influencer",
          isVerified: true
        }).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetInfluencers.length} currently selected influencers`);
      } else if (post.allStates === true) {
        // All states
        currentTargetInfluencers = await User.find({
          role: "Influencer",
          isVerified: true
        }).select("name email mobile iinsafId state city");
        console.log(`🌍 Found ${currentTargetInfluencers.length} influencers (all states)`);
      } else if (post.adminSelectState && post.adminSelectState.length > 0) {
        // Admin selected states
        const query = {
          role: "Influencer",
          isVerified: true,
          state: { $in: post.adminSelectState }
        };
        
        if (post.adminSelectCities && post.adminSelectCities.length > 0) {
          query.city = { $in: post.adminSelectCities };
        }
        
        currentTargetInfluencers = await User.find(query).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetInfluencers.length} influencers in selected states/cities`);
      } else if (post.adminSelectCities && post.adminSelectCities.length > 0) {
        // Admin selected cities
        currentTargetInfluencers = await User.find({
          role: "Influencer",
          isVerified: true,
          city: { $in: post.adminSelectCities }
        }).select("name email mobile iinsafId state city");
        console.log(`🏙️ Found ${currentTargetInfluencers.length} influencers in selected cities`);
      } else {
        // Default behavior - match by original state and city
        currentTargetInfluencers = await User.find({
          role: "Influencer",
          isVerified: true,
          state: post.state,
          city: post.city
        }).select("name email mobile iinsafId state city");
        console.log(`📍 Found ${currentTargetInfluencers.length} influencers in original location`);
      }
      
      // Add current targeting influencers to the set
      currentTargetInfluencers.forEach(influencer => {
        allTargetedInfluencers.add(influencer._id.toString());
        console.log(`🎯 Added current targeting influencer: ${influencer.name} (${influencer._id})`);
      });
      
      // For modified posts, also add ORIGINAL default targeting (state/city based)
      if (post.status === "modified") {
        console.log(`🔄 Raise Your Voice Post is MODIFIED - also adding original default targeting for influencers`);
        
        // Add ORIGINAL default targeting (state/city based)
        const originalTargetInfluencers = await User.find({
          role: "Influencer",
          isVerified: true,
          state: post.state,
          city: post.city
        }).select("name email mobile iinsafId state city");
        
        originalTargetInfluencers.forEach(influencer => {
          allTargetedInfluencers.add(influencer._id.toString());
          console.log(`📍 Added ORIGINAL default influencer: ${influencer.name} (${influencer._id})`);
        });
        
        console.log(`📍 Added ${originalTargetInfluencers.length} original default influencers`);
      }
    }
    
    console.log(`📊 Total unique reporters after adding current targeting: ${allTargetedReporters.size}`);
    console.log(`📊 Total unique influencers after adding current targeting: ${allTargetedInfluencers.size}`);
    
    // Get all unique reporter IDs
    const allReporterIds = Array.from(allTargetedReporters);
    const allInfluencerIds = Array.from(allTargetedInfluencers);
    
    console.log(`📊 Total unique reporters targeted: ${allReporterIds.length}`);
    console.log(`📊 Total unique influencers targeted: ${allInfluencerIds.length}`);
    console.log(`📊 All reporter IDs:`, allReporterIds);
    console.log(`📊 All influencer IDs:`, allInfluencerIds);
    
    // Fetch all targeted reporters
    const targetReporters = shouldTargetReporters ? await User.find({
      _id: { $in: allReporterIds },
      role: "Reporter",
      verifiedReporter: true
    }).select("name email mobile iinsafId state city") : [];
    
    // Fetch all targeted influencers
    const targetInfluencers = shouldTargetInfluencers ? await User.find({
      _id: { $in: allInfluencerIds },
      role: "Influencer",
      isVerified: true
    }).select("name email mobile iinsafId state city") : [];
    
    console.log(`✅ Final target reporters count: ${targetReporters.length}`);
    console.log(`✅ Final target influencers count: ${targetInfluencers.length}`);
    
    // Get all responses for this post (already fetched above)
    const allReporterResponses = existingReporterResponses;
    const allInfluencerResponses = existingInfluencerResponses;
    
    // Create a map of responses by user ID
    const responseMap = {};
    
    // Add reporter responses to the map
    allReporterResponses.forEach(response => {
      responseMap[response.reporterId._id.toString()] = {
        status: response.status,
        acceptedAt: response.status === "accepted" ? response.submittedAt : null,
        rejectedAt: response.status === "rejected" ? response.reviewedAt : null,
        rejectNote: response.rejectionNote || null,
        proofSubmitted: response.proof || false,
        proofDetails: response.proof ? {
          videoLink: response.videoLink,
          platform: response.platform,
          duration: response.duration
        } : null
      };
    });
    
    // Add influencer responses to the map
    allInfluencerResponses.forEach(response => {
      responseMap[response.influencerId._id.toString()] = {
        status: response.status,
        acceptedAt: response.status === "accepted" ? response.submittedAt : null,
        rejectedAt: response.status === "rejected" ? response.reviewedAt : null,
        rejectNote: response.rejectionNote || null,
        proofSubmitted: response.proof || false,
        proofDetails: response.proof ? {
          videoLink: response.videoLink,
          platform: response.platform,
          duration: response.duration
        } : null
      };
    });
    
    // Combine target reporters with their response status
    const reportersWithStatus = targetReporters.map(reporter => {
      const response = responseMap[reporter._id.toString()];
      return {
        userId: reporter._id,
        userName: reporter.name,
        userEmail: reporter.email,
        userMobile: reporter.mobile,
        iinsafId: reporter.iinsafId,
        userState: reporter.state,
        userCity: reporter.city,
        userType: "reporter",
        status: response ? response.status : "pending", // pending, accepted, rejected, completed
        acceptedAt: response?.acceptedAt || null,
        rejectedAt: response?.rejectedAt || null,
        rejectNote: response?.rejectNote || null,
        proofSubmitted: response?.proofSubmitted || false,
        proofDetails: response?.proofDetails || null,
        hasPostInPanel: true // All these reporters have the post in their panel
      };
    });
    
    // Combine target influencers with their response status
    const influencersWithStatus = targetInfluencers.map(influencer => {
      const response = responseMap[influencer._id.toString()];
      return {
        userId: influencer._id,
        userName: influencer.name,
        userEmail: influencer.email,
        userMobile: influencer.mobile,
        iinsafId: influencer.iinsafId,
        userState: influencer.state,
        userCity: influencer.city,
        userType: "influencer",
        status: response ? response.status : "pending", // pending, accepted, rejected, completed
        acceptedAt: response?.acceptedAt || null,
        rejectedAt: response?.rejectedAt || null,
        rejectNote: response?.rejectNote || null,
        proofSubmitted: response?.proofSubmitted || false,
        proofDetails: response?.proofDetails || null,
        hasPostInPanel: true // All these influencers have the post in their panel
      };
    });
    
    // Combine all users
    const allUsersWithStatus = [...reportersWithStatus, ...influencersWithStatus];
    
    // Group by status
    const groupedUsers = {
      pending: allUsersWithStatus.filter(u => u.status === "pending"),
      accepted: allUsersWithStatus.filter(u => u.status === "accepted"),
      rejected: allUsersWithStatus.filter(u => u.status === "rejected"),
      completed: allUsersWithStatus.filter(u => u.status === "completed")
    };
    
    // Group by user type
    const groupedByUserType = {
      reporters: reportersWithStatus,
      influencers: influencersWithStatus
    };
    
    res.status(200).json({
      success: true,
      message: "Raise Your Voice post targeted users fetched successfully",
      data: {
        postId: postId,
        targetUserType: post.targetUserType,
        totalTargetedUsers: allUsersWithStatus.length,
        totalTargetedReporters: targetReporters.length,
        totalTargetedInfluencers: targetInfluencers.length,
        pending: groupedUsers.pending.length,
        accepted: groupedUsers.accepted.length,
        rejected: groupedUsers.rejected.length,
        completed: groupedUsers.completed.length,
        users: allUsersWithStatus,
        reporters: reportersWithStatus,
        influencers: influencersWithStatus,
        grouped: groupedUsers,
        groupedByUserType: groupedByUserType,
        targetingInfo: {
          allStates: post.allStates,
          adminSelectState: post.adminSelectState,
          adminSelectCities: post.adminSelectCities,
          adminSelectPincode: post.adminSelectPincode,
          reporterId: post.reporterId,
          originalState: post.state,
          originalCity: post.city,
          modifiedAt: post.modifiedAt,
          targetUserType: post.targetUserType
        }
      }
    });
    
  } catch (error) {
    console.error("Error fetching Raise Your Voice post targeted users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching Raise Your Voice post targeted users",
    });
  }
};

// Delete user (reporter or influencer) from Raise Your Voice post
const deleteReporterFromRyvPost = async (req, res) => {
  try {
    const { postId, reporterId } = req.params;
    
    console.log(`🗑️ Deleting user ${reporterId} from Raise Your Voice post ${postId}`);
    console.log(`📊 Parameters - postId: "${postId}", reporterId: "${reporterId}"`);
    
    // Find and delete the user proof record
    const mongoose = require("mongoose");
    const queryUserId = new mongoose.Types.ObjectId(reporterId);
    const queryPostId = new mongoose.Types.ObjectId(postId);
    
    // First, let's check if the record exists in reporter proof
    let existingRecord = await RaiseYourVoiceProof.findOne({
      adId: queryPostId,
      reporterId: queryUserId
    });
    
    let isReporter = true;
    
    // If not found in reporter proof, check influencer proof
    if (!existingRecord) {
      const RaiseYourVoiceInfluencerProof = require("../../../models/raiseYourVoicePost/raiseYourVoiceInfluencerProofSubmit");
      existingRecord = await RaiseYourVoiceInfluencerProof.findOne({
        adId: queryPostId,
        influencerId: queryUserId
      });
      isReporter = false;
    }
    
    console.log(`🔍 Existing record found:`, existingRecord ? "YES" : "NO");
    if (existingRecord) {
      console.log(`📋 Record details:`, {
        _id: existingRecord._id,
        adId: existingRecord.adId,
        reporterId: existingRecord.reporterId,
        status: existingRecord.status
      });
    } else {
      // Check if this reporter was even targeted for this post
      const post = await RaiseYourVoice.findById(postId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Raise Your Voice post not found",
        });
      }
      
      // Check if reporter was targeted
      let isTargeted = false;
      
      if (post.reporterId && post.reporterId.length > 0) {
        isTargeted = post.reporterId.some(id => id.toString() === reporterId);
      } else if (post.allStates === true) {
        isTargeted = true;
      } else if (post.adminSelectState && post.adminSelectState.length > 0) {
        // Check if reporter's state matches
        const reporter = await User.findById(reporterId);
        if (reporter) {
          isTargeted = post.adminSelectState.includes(reporter.state);
        }
      }
      
      if (!isTargeted) {
        return res.status(404).json({
          success: false,
          message: "This reporter was not targeted for this Raise Your Voice post",
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "This user has not responded to the Raise Your Voice post yet. Only users who have accepted or rejected can be removed.",
      });
    }
    
    // Delete the existing record
    let deleteResult;
    
    try {
      if (isReporter) {
        deleteResult = await RaiseYourVoiceProof.deleteOne({
          adId: queryPostId,
          reporterId: queryUserId
        });
      } else {
        const RaiseYourVoiceInfluencerProof = require("../../../models/raiseYourVoicePost/raiseYourVoiceInfluencerProofSubmit");
        deleteResult = await RaiseYourVoiceInfluencerProof.deleteOne({
          adId: queryPostId,
          influencerId: queryUserId
        });
      }
      
      console.log(`🔍 Delete result: deletedCount = ${deleteResult.deletedCount}`);
      
    } catch (deleteError) {
      console.error(`❌ Delete error:`, deleteError);
      return res.status(500).json({
        success: false,
        message: "Error during deletion process",
      });
    }
    
    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Reporter not found in this Raise Your Voice post",
      });
    }
    
    console.log(`✅ Successfully deleted reporter ${reporterId} from Raise Your Voice post ${postId}`);
    
    res.status(200).json({
      success: true,
      message: `${isReporter ? 'Reporter' : 'Influencer'} removed from Raise Your Voice post successfully`,
      data: {
        postId: postId,
        userId: reporterId,
        userType: isReporter ? 'reporter' : 'influencer',
        deletedCount: deleteResult.deletedCount
      }
    });
    
  } catch (error) {
    console.error("Error deleting reporter from Raise Your Voice post:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting reporter from Raise Your Voice post",
    });
  }
};

module.exports = {
  getUnderReviewRyvAds,
  approveRyvAd,
  rejectRyvAd,
  getRunningRyvAds,
  getApprovedRyvAds,
  adminAcceptTheProof,
  adminRejectTheProof,
  adminGetRejectedProofs,
  getRyvAdsStatsForAdmin,
  adminGetRyvPostHistory,
  getAcceptedRyvProofs,
  getCompletedRyvAds,
  modifyRyvAd,
  getSingleRyvAd,
  getAllRyvAds,
  getRyvPostTargetedReporters,
  deleteReporterFromRyvPost
};
