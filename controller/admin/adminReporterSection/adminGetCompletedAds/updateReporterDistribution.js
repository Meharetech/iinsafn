const Adpost = require("../../../../models/advertismentPost/advertisementPost");
const AdPricing = require("../../../../models/adminModels/advertismentPriceSet/adPricingSchema");

const updateReporterDistribution = async (req, res) => {
  try {
    const { adId } = req.params;
    const { requiredReporter, baseView, requiredViews } = req.body;

    // Validate input
    if (!requiredReporter || requiredReporter < 1) {
      return res.status(400).json({
        success: false,
        message: "Required reporters must be at least 1"
      });
    }

    if (!baseView || baseView < 1) {
      return res.status(400).json({
        success: false,
        message: "Base view must be at least 1"
      });
    }

    if (!requiredViews || requiredViews < 1) {
      return res.status(400).json({
        success: false,
        message: "Required views must be at least 1"
      });
    }

    // Find the advertisement
    const advertisement = await Adpost.findById(adId);
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found"
      });
    }

    // Get pricing information
    const pricing = await AdPricing.findOne();
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Pricing configuration not found"
      });
    }

    // Calculate new financial values
    const adminCommissionPercentage = pricing.adCommission || 69; // Default 69%
    const reporterPricePerView = pricing.reporterPrice || 0.02; // Default ₹0.02 per view

    // Calculate views per reporter based on total required views
    const viewsPerReporter = Math.ceil(requiredViews / requiredReporter);

    // Calculate reporter price per reporter
    const finalReporterPrice = viewsPerReporter * reporterPricePerView;

    // Calculate total reporter budget
    const totalReporterBudget = finalReporterPrice * requiredReporter;

    // Calculate admin commission
    const adminCommission = (totalReporterBudget * adminCommissionPercentage) / 100;

    // Calculate total cost
    const totalCost = totalReporterBudget + adminCommission;

    // Update the advertisement
    const updatedAdvertisement = await Adpost.findByIdAndUpdate(
      adId,
      {
        requiredReporter: requiredReporter,
        baseView: viewsPerReporter, // ✅ Use calculated distributed views
        requiredViews: requiredViews,
        finalReporterPrice: finalReporterPrice,
        adminCommission: adminCommission,
        totalCost: totalCost,
        // Update the acceptRejectReporterList to match new requiredReporter count
        $set: {
          "acceptRejectReporterList": advertisement.acceptRejectReporterList.slice(0, requiredReporter)
        }
      },
      { new: true }
    );

    if (!updatedAdvertisement) {
      return res.status(404).json({
        success: false,
        message: "Failed to update advertisement"
      });
    }

    res.status(200).json({
      success: true,
      message: "Reporter distribution updated successfully",
      data: {
        requiredReporter: requiredReporter,
        baseView: baseView,
        requiredViews: requiredViews,
        viewsPerReporter: viewsPerReporter,
        finalReporterPrice: finalReporterPrice,
        adminCommission: adminCommission,
        totalCost: totalCost,
        totalReporterBudget: totalReporterBudget,
        adminCommissionPercentage: adminCommissionPercentage,
        reporterPricePerView: reporterPricePerView
      }
    });

  } catch (error) {
    console.error("Error updating reporter distribution:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = updateReporterDistribution;
