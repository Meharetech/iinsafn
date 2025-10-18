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

    // Step 4: Enhance proofs with detailed advertisement information
    const enhancedProofs = proofs.map(proof => {
      // Find the corresponding advertisement
      const advertisement = ads.find(ad => ad._id.toString() === proof.adId.toString());
      
      if (advertisement) {
        return {
          ...proof.toObject(), // Convert mongoose document to plain object
          // Add detailed advertisement information
          adId: advertisement._id,
          adType: advertisement.adType,
          mediaType: advertisement.mediaType,
          mediaDescription: advertisement.mediaDescription,
          userType: advertisement.userType,
          requiredViews: advertisement.requiredViews,
          adLength: advertisement.adLength,
          totalCost: advertisement.totalCost,
          startDate: advertisement.startDate,
          endDate: advertisement.endDate,
          pfState: advertisement.pfState,
          pfCities: advertisement.pfCities,
          createdAt: advertisement.createdAt,
          approvedAt: advertisement.approvedAt,
          imageUrl: advertisement.imageUrl,
          videoUrl: advertisement.videoUrl,
          requiredReporter: advertisement.requiredReporter,
          // Additional fields that might be useful
          allStates: advertisement.allStates,
          adminSelectState: advertisement.adminSelectState,
          adminSelectCities: advertisement.adminSelectCities,
          adminSelectPincode: advertisement.adminSelectPincode,
          status: advertisement.status,
          updatedAt: advertisement.updatedAt
        };
      }
      
      // If no matching advertisement found, return proof as is
      return proof.toObject();
    });

    console.log(`📊 Enhanced ${enhancedProofs.length} completed advertisements with detailed information`);

    return res.status(200).json({ 
      completedProofs: enhancedProofs,
      totalCount: enhancedProofs.length,
      message: "Completed advertisements with detailed information fetched successfully"
    });
  } catch (error) {
    console.error("Error fetching completed ad proofs:", error);
    return res.status(500).json({ message: "Server error while fetching ad proofs." });
  }
};

module.exports = advertiserGetCompletedAds;