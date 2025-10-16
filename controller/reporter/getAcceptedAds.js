const Adpost = require("../../models/advertismentPost/advertisementPost");

const getAcceptedAds = async (req, res) => {
  try {
    const reporterId = req.user._id;

    const matchedAds = await Adpost.find({
      acceptRejectReporterList: {
        $elemMatch: {
          reporterId: reporterId,
          postStatus: "accepted", // ✅ Use new postStatus field
          adProof: false // ✅ Only show if adProof is still false (no initial proof submitted yet)
        }
      }
    });

    res.status(200).json({
      success: true,
      message: "Ads fetched where reporter has accepted and not yet submitted proof",
      data: matchedAds
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
