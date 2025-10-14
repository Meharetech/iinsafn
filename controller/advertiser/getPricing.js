const AdPricing = require("../../models/adminModels/advertismentPriceSet/adPricingSchema");

const getPricing = async (req, res) => {
  
  try {
    // Fetch the latest (or only) pricing document
    const pricing = await AdPricing.findOne();

    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "No ad pricing configuration found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Ad pricing data fetched successfully",
      data: pricing,
    });
  } catch (error) {
    console.error("Error fetching ad pricing:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = getPricing;
