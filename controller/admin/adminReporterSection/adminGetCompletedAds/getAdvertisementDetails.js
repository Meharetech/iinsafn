const Adpost = require("../../../../models/advertismentPost/advertisementPost");

const getAdvertisementDetails = async (req, res) => {
  try {
    const { adId } = req.params;

    // Find the advertisement
    const advertisement = await Adpost.findById(adId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found"
      });
    }

    res.status(200).json({
      success: true,
      data: advertisement
    });

  } catch (error) {
    console.error("Error fetching advertisement details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = getAdvertisementDetails;
