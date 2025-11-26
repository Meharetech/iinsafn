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

    // ✅ Step 1: Find ads where user accepted but hasn't submitted proof yet (postStatus: "accepted", adProof: false)
    const matchedAds = await Adpost.find({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: reporterId,
          postStatus: "accepted", // ✅ Use new postStatus field
          adProof: false // ✅ Only show if adProof is still false (no initial proof submitted yet)
        }
      }
    });

    // ✅ Step 2: Find ads where initial proof was approved (proof status: "approved")
    // These should also appear in accepted ads so user can proceed with final proof
    const approvedProofAds = await reporterAdProof.find({
      proofs: {
        $elemMatch: {
          reporterId: reporterId,
          status: "approved" // ✅ Initial proof approved - user can now proceed with final proof
        }
      }
    });

    // ✅ Step 3: Get adIds from approved proofs
    const approvedAdIds = approvedProofAds.map(doc => doc.adId.toString());

    // ✅ Step 4: Fetch full ad details for approved proofs where postStatus is "accepted"
    // This ensures we only show ads where user can submit final proof
    const approvedAds = approvedAdIds.length > 0 
      ? await Adpost.find({ 
          _id: { $in: approvedAdIds },
          acceptRejectReporterList: {
            $elemMatch: {
              reporterId: reporterId,
              postStatus: "accepted" // ✅ Only show if postStatus is "accepted" (not "submitted" or "proof_submitted")
            }
          }
        })
      : [];

    // ✅ Step 5: Combine both sets of ads (avoid duplicates)
    const allAdsMap = new Map();
    
    // Add matched ads (accepted but no proof submitted)
    matchedAds.forEach(ad => {
      allAdsMap.set(ad._id.toString(), ad);
    });

    // Add approved proof ads (initial proof approved, can submit final proof)
    approvedAds.forEach(ad => {
      allAdsMap.set(ad._id.toString(), ad);
    });

    const allAds = Array.from(allAdsMap.values());

    // ✅ Step 6: Enhanced response with rejection information for initial proofs and proof data
    const enhancedAds = allAds.map(ad => {
      const reporterEntry = ad.acceptRejectReporterList.find(r => r.reporterId.toString() === reporterId.toString());
      
      // Find proof data if exists
      const proofDoc = approvedProofAds.find(doc => doc.adId.toString() === ad._id.toString());
      const proofData = proofDoc?.proofs?.find(p => p.reporterId.toString() === reporterId.toString() && p.status === "approved");

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
        // ✅ Include proof data if initial proof was approved
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
