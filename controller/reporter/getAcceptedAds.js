const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");

const getAcceptedAds = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const User = require("../../models/userModel/userModel");
    const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");

    // ✅ VERIFICATION CHECK: Only verified users can access paid ads
    const user = await User.findById(reporterId);
    if (!user || !user.verifiedReporter) {
      const userType = user?.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `You are not a verified ${userType}. Please apply for and get your ID card approved first to access paid advertisements.`,
        data: []
      });
    }

    // ✅ Additional check: Verify ID card status is actually "Approved"
    const idCard = await genrateIdCard.findOne({ reporter: reporterId });
    if (!idCard || idCard.status !== "Approved") {
      const userType = user.role === "Influencer" ? "influencer" : "reporter";
      return res.status(403).json({
        success: false,
        message: `Your ID card is not approved yet. Please wait for admin approval to access paid advertisements.`,
        data: []
      });
    }

    // ✅ Step 1: Find ads where user accepted (postStatus: "accepted" or "proof_rejected")
    // "proof_rejected" means final proof was rejected by admin - user needs to resubmit
    const matchedAds = await Adpost.find({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: reporterId,
          postStatus: { $in: ["accepted", "proof_rejected"] } // ✅ Show accepted ads and proof_rejected (final proof rejected)
        }
      }
    });

    // ✅ Step 2: Get all proof documents for these ads
    const adIds = matchedAds.map(ad => ad._id);
    const allProofDocs = await reporterAdProof.find({
      adId: { $in: adIds }
    });

    // ✅ Step 3: Filter ads - only show if user needs to take action
    const filteredAds = matchedAds.filter(ad => {
      const reporterEntry = ad.acceptRejectReporterList.find(
        r => r.reporterId.toString() === reporterId.toString()
      );

      if (!reporterEntry) {
        return false; // No entry found
      }

      // ✅ Show if postStatus is "proof_rejected" (final proof rejected by admin - user needs to resubmit)
      if (reporterEntry.postStatus === "proof_rejected") {
        return true;
      }

      // ✅ Show if postStatus is "accepted"
      if (reporterEntry.postStatus !== "accepted") {
        return false; // Wrong status
      }

      // Find proof for this ad and reporter
      const proofDoc = allProofDocs.find(doc => doc.adId.toString() === ad._id.toString());
      const userProof = proofDoc?.proofs?.find(
        p => p.reporterId.toString() === reporterId.toString()
      );

      // ✅ Show if:
      // 1. No proof submitted yet (adProof: false)
      if (!reporterEntry.adProof && !userProof) {
        return true;
      }

      // 2. Initial proof was approved - user can submit final proof
      if (userProof && userProof.status === "approved") {
        return true;
      }

      // 3. Initial proof was rejected by admin - user needs to resubmit initial proof
      if (userProof && userProof.status === "rejected" && userProof.initialProofRejectedAt) {
        return true;
      }

      // ✅ Don't show if:
      // - Proof is submitted (waiting for admin review)
      // - Proof is completed
      if (userProof && (userProof.status === "submitted" || userProof.status === "completed")) {
        return false;
      }

      // Don't show if postStatus indicates proof already submitted (but not proof_rejected)
      if (reporterEntry.postStatus === "pending" || 
          reporterEntry.postStatus === "submitted" || 
          reporterEntry.postStatus === "proof_submitted" || 
          reporterEntry.postStatus === "completed") {
        return false;
      }

      return false; // Default: don't show
    });

    // ✅ Step 4: Enhanced response with proof data
    const enhancedAds = filteredAds.map(ad => {
      const reporterEntry = ad.acceptRejectReporterList.find(
        r => r.reporterId.toString() === reporterId.toString()
      );
      
      // Find proof data if exists
      const proofDoc = allProofDocs.find(doc => doc.adId.toString() === ad._id.toString());
      const proofData = proofDoc?.proofs?.find(
        p => p.reporterId.toString() === reporterId.toString()
      );

      return {
        ...ad.toObject(),
        reporterEntry: {
          postStatus: reporterEntry?.postStatus,
          acceptedAt: reporterEntry?.acceptedAt,
          adProof: reporterEntry?.adProof,
          initialProofRejected: reporterEntry?.initialProofRejected || false,
          initialProofRejectNote: reporterEntry?.initialProofRejectNote,
          initialProofRejectedAt: reporterEntry?.initialProofRejectedAt,
          initialProofRejectedByName: reporterEntry?.initialProofRejectedByName,
        },
        // ✅ Include proof data if exists and is relevant
        proofs: proofData ? [proofData] : [],
        proofInfo: proofData ? {
          status: proofData.status,
          screenshot: proofData.screenshot,
          channelName: proofData.channelName,
          platform: proofData.platform,
          videoLink: proofData.videoLink,
          duration: proofData.duration,
          initialProofApprovedAt: proofData.initialProofApprovedAt,
          initialProofApprovedByName: proofData.initialProofApprovedByName,
          initialProofRejectedAt: proofData.initialProofRejectedAt,
          initialProofRejectNote: proofData.initialProofRejectNote,
        } : null
      };
    });

    res.status(200).json({
      success: true,
      message: "Ads fetched where reporter has accepted (or initial proof approved) and can proceed with task",
      data: enhancedAds
    });

  } catch (error) {
    console.error("Error fetching accepted ads:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching ads"
    });
  }
};


const getRejectedAds = async(req,res)=>{
    try {
        const reporterId = req.user._id;
        const User = require("../../models/userModel/userModel");
        const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");

        // ✅ VERIFICATION CHECK: Only verified users can access paid ads
        const user = await User.findById(reporterId);
        if (!user || !user.verifiedReporter) {
            const userType = user?.role === "Influencer" ? "influencer" : "reporter";
            return res.status(403).json({
                success: false,
                message: `You are not a verified ${userType}. Please apply for and get your ID card approved first to access paid advertisements.`,
                data: []
            });
        }

        // ✅ Additional check: Verify ID card status is actually "Approved"
        const idCard = await genrateIdCard.findOne({ reporter: reporterId });
        if (!idCard || idCard.status !== "Approved") {
            const userType = user.role === "Influencer" ? "influencer" : "reporter";
            return res.status(403).json({
                success: false,
                message: `Your ID card is not approved yet. Please wait for admin approval to access paid advertisements.`,
                data: []
            });
        }

        // Find ads rejected by this specific reporter
        const matchedAds = await Adpost.find({
            acceptRejectReporterList: {
                $elemMatch: {
                    reporterId: reporterId,
                    postStatus: "rejected"
                }
            }
        });

        console.log("Found rejected ads for reporter:", matchedAds.length);

        // Process ads to include reporter-specific rejection data
        const processedAds = matchedAds.map(ad => {
            // Find the current reporter's rejection data
            const reporterRejection = ad.acceptRejectReporterList.find(
                reporter => reporter.reporterId && reporter.reporterId.toString() === reporterId.toString() && reporter.postStatus === "rejected"
            );
            
            return {
                ...ad.toObject(),
                rejectNote: reporterRejection?.rejectNote || "No reason provided",
                rejectedAt: reporterRejection?.rejectedAt
            };
        });

        res.status(200).json({
            success: true,
            message: "Ads fetched where reporter has responded",
            data: processedAds
        });

    } catch (error) {
        console.error("Error fetching rejected ads:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching ads"
        });
    }

}

module.exports = {getAcceptedAds, getRejectedAds}
