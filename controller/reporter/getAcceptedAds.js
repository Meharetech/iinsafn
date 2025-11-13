const Adpost = require("../../models/advertismentPost/advertisementPost");

const getAcceptedAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    const matchedAds = await Adpost.find({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: reporterId,
          postStatus: "accepted", // ✅ Only show if status is "accepted" (accepted but proof not submitted)
          adProof: false // ✅ Only show if adProof is still false (no initial proof submitted yet)
        }
      }
    });

    // ✅ Additional filter: Exclude ads where proof was already submitted (status is "pending" after submission)
    // When proof is submitted, postStatus changes to "pending" (waiting admin), so those won't match above query
    // But also double-check to ensure no ads with submitted proof slip through
    const filteredAds = matchedAds.filter(ad => {
      const reporterEntry = ad.acceptRejectReporterList.find(
        r => r.reporterId.toString() === reporterId.toString()
      );
      
      // Exclude if proof was already submitted (adProof is true or postStatus is "pending" after submission)
      if (reporterEntry) {
        // If adProof is true, it means proof was submitted - don't show
        if (reporterEntry.adProof === true) {
          console.log(`🔍 Filtering out ad ${ad._id} from Accepted Leads - Proof already submitted (adProof: true)`);
          return false;
        }
        
        // If postStatus is "pending" and adProof is true, proof was submitted - don't show
        if (reporterEntry.postStatus === "pending" && reporterEntry.adProof === true) {
          console.log(`🔍 Filtering out ad ${ad._id} from Accepted Leads - Proof submitted, waiting admin`);
          return false;
        }
        
        // If postStatus is "approved", initial proof was approved - don't show in accepted leads
        if (reporterEntry.postStatus === "approved") {
          console.log(`🔍 Filtering out ad ${ad._id} from Accepted Leads - Initial proof approved, should be in running ads`);
          return false;
        }
      }
      
      return true;
    });

    // ✅ Enhanced response with rejection information for initial proofs
    const enhancedAds = filteredAds.map(ad => {
      const reporterEntry = ad.acceptRejectReporterList.find(r => r.reporterId.toString() === reporterId.toString());
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
        }
      };
    });

    res.status(200).json({
      success: true,
      message: "Ads fetched where reporter has accepted and not yet submitted proof",
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
