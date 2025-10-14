const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");

const advertiserGetCompletedAds = async (req, res) => {
  const owner = req.user._id;

  try {
    // Step 1: Get all ads posted by this owner
    const ads = await Adpost.find({ owner });

    if (!ads || ads.length === 0) {
      return res.status(404).json({
        message: "No ads found for this advertiser.",
      });
    }

    // Step 2: Extract all ad IDs
    const adIds = ads.map((ad) => ad._id);

    // Step 3: Get reporter proofs by ad ID
    const proofs = await reporterAdProof.find({
      adId: { $in: adIds },
      runningAdStatus: "completed",
    });

    if (!proofs || proofs.length === 0) {
      return res.status(404).json({
        message: "No completed ad proofs found for this advertiser.",
      });
    }

    return res.status(200).json({ completedProofs: proofs });
  } catch (error) {
    console.error("Error fetching completed ad proofs:", error);
    return res.status(500).json({ message: "Server error while fetching ad proofs." });
  }
};

module.exports = advertiserGetCompletedAds;