const Adpost = require('../../models/advertismentPost/advertisementPost')


const getAdvertisementsByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user._id;

    const filteredAds = await Adpost.find({ owner: userId, status });

    res.status(200).json(filteredAds);
  } catch (error) {
    console.error("Error fetching advertisements:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getAllAds = async (req, res) => {
  try {
    const userId = req.user._id;

    const allAds = await Adpost.find({ owner: userId});

    res.status(200).json(allAds);
  } catch (error) {
    console.error("Error fetching advertisements:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};




// Get all ads of the advertiser with accepted reporters
const getAdvertiserAcceptedReporters = async (req, res) => {
  try {
    const advertiserId = req.user._id; // from authenticated user

    // Fetch all ads of this advertiser that are not completed and pending
    const ads = await Adpost.find({
  owner: advertiserId,
  status: { $nin: ["completed", "pending"] }  // exclude both completed & pending
});

    if (!ads.length) {
      return res.status(404).json({ success: false, message: "No ads found for this advertiser" });
    }

    const data = ads.map(ad => {
      const acceptedReporters = ad.acceptRejectReporterList.filter(r => r.accepted);

      return {
        adId: ad._id,
        imageUrl: ad.imageUrl,
        videoUrl: ad.videoUrl,
        requiredReporter: ad.requiredReporter,
        adTitle: ad.mediaDescription,
        totalReporters: ad.acceptRejectReporterList.length,
        acceptedCount: acceptedReporters.length,
        acceptedReporters
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching advertiser's accepted reporters:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};




module.exports = {getAdvertisementsByStatus, getAllAds, getAdvertiserAcceptedReporters}