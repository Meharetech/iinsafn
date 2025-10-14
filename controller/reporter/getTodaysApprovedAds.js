const Adpost = require("../../models/advertismentPost/advertisementPost");

const getTodaysApprovedAdsMediaOnly = async (req, res) => {
  try {
    // Step 1: Get today's time window
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Step 2: Fetch only approved ads created today
    const todaysApprovedAds = await Adpost.find({
      status: 'approved',
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    // Step 3: Map to return only imageUrl or videoUrl
    const mediaOnly = todaysApprovedAds.map(ad => {
      return {
        imageUrl: ad.imageUrl || null,
        videoUrl: ad.videoUrl || null
      };
    });

    res.status(200).json({
      success: true,
      message: "Today's approved media URLs fetched successfully",
      data: mediaOnly
    });

  } catch (error) {
    console.error("Error fetching today's approved media URLs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching today's approved media URLs"
    });
  }
};

module.exports = getTodaysApprovedAdsMediaOnly;
