const Adpost = require("../../../../models/advertismentPost/advertisementPost");
const AdPricing = require("../../../../models/adminModels/advertismentPriceSet/adPricingSchema");

const updateControls = async (req, res) => {
  try {
    const { adId } = req.params;
    const { baseView, commissionPercentage } = req.body;

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

    let updateData = {};
    let newRequiredReporter = advertisement.requiredReporter;
    let newAdminCommission = advertisement.adminCommission;
    let newFinalReporterPrice = advertisement.finalReporterPrice;
    let newTotalCost = advertisement.totalCost;

    // Update base view if provided
    if (baseView !== undefined) {
      if (baseView < 0) {
        return res.status(400).json({
          success: false,
          message: "Base view must be 0 or greater"
        });
      }

      updateData.baseView = baseView;
      
      // Calculate new required reporters based on base view
      const requiredViews = advertisement.requiredViews || 0;
      newRequiredReporter = baseView > 0 ? Math.ceil(requiredViews / baseView) : 0;
      updateData.requiredReporter = newRequiredReporter;
    }

    // Update commission if provided
    if (commissionPercentage !== undefined) {
      if (commissionPercentage < 0 || commissionPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: "Commission percentage must be between 0 and 100"
        });
      }

      // Calculate new financial values based on commission percentage
      const totalCost = advertisement.totalCost;
      newAdminCommission = (totalCost * commissionPercentage) / 100;
      const newReporterReward = totalCost - newAdminCommission;
      
      // Calculate new finalReporterPrice per reporter
      const requiredReporter = newRequiredReporter || advertisement.requiredReporter || 1;
      newFinalReporterPrice = requiredReporter > 0 ? newReporterReward / requiredReporter : 0;

      updateData.adminCommission = newAdminCommission;
      updateData.finalReporterPrice = newFinalReporterPrice;
    }

    // Update the advertisement
    const updatedAdvertisement = await Adpost.findByIdAndUpdate(
      adId,
      updateData,
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
      message: "Controls updated successfully",
      data: {
        baseView: updatedAdvertisement.baseView,
        requiredReporter: updatedAdvertisement.requiredReporter,
        commissionPercentage: commissionPercentage || (advertisement.totalCost > 0 ? ((updatedAdvertisement.adminCommission / advertisement.totalCost) * 100) : 0),
        adminCommission: updatedAdvertisement.adminCommission,
        finalReporterPrice: updatedAdvertisement.finalReporterPrice,
        totalCost: updatedAdvertisement.totalCost
      }
    });

  } catch (error) {
    console.error("Error updating controls:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = updateControls;
