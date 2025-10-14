const AdPricing = require("../../../../models/adminModels/advertismentPriceSet/adPricingSchema");

// const adminSetAdPrice = async (req, res) => {
//   try {

//     console.log("that is my body data",req.body)

//     const {
//       adType,
//       plateforms,
//       channelType,
//       gstRate,
//       perDayPrice,
//       perSecPrice,
//       baseView,
//       perCityPrice,
//       adCommission,
//       withdrawAmount
//     } = req.body;

//     // Build update object only with provided (non-undefined) fields
//     const updateFields = {};

//     if (adType !== undefined) updateFields.adType = adType;
//     if (channelType !== undefined) updateFields.channelType = channelType;
//     if (plateforms !== undefined) updateFields.plateforms = plateforms;
//     if (gstRate !== undefined) updateFields.gstRate = gstRate;
//     if (perDayPrice !== undefined) updateFields.perDayPrice = perDayPrice;
//     if (perSecPrice !== undefined) updateFields.perSecPrice = perSecPrice;
//     if (baseView !== undefined) updateFields.baseView = baseView;
//     if (perCityPrice !== undefined) updateFields.perCityPrice = perCityPrice;
//     if (adCommission !== undefined) updateFields.adCommission = adCommission;

//     // ✅ Only update if it's a number
//     if (withdrawAmount !== undefined && withdrawAmount !== "" && !isNaN(withdrawAmount)) {
//       updateFields.minimumWithdrawAmountForReporter = Number(withdrawAmount);
//     }

//     const pricing = await AdPricing.findOneAndUpdate(
//       {}, // condition (single global config)
//       { $set: updateFields }, // only update non-empty fields
//       { new: true, upsert: true }
//     );

//     res.status(200).json({ success: true, message: "Ad pricing updated", data: pricing });
//   } catch (error) {
//     console.error("Error in adminSetAdPrice:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };





const adminSetAdPrice = async (req, res) => {
  try {
    // console.log("that is my body data", req.body);

    const {
      adType,
      plateforms,
      channelType,
      gstRate,
      perDayPrice,
      perSecPrice,
      baseView,
      perCityPrice,
      adCommission,
      withdrawAmount
    } = req.body;

    // Build update object only with provided (non-undefined and non-empty) fields
    const updateFields = {};

    if (adType !== undefined && adType !== "") updateFields.adType = adType;
    if (channelType !== undefined && channelType !== "") updateFields.channelType = channelType;
    if (plateforms !== undefined && plateforms.length > 0) updateFields.plateforms = plateforms;

    if (gstRate !== undefined && gstRate !== "") updateFields.gstRate = Number(gstRate);
    if (perDayPrice !== undefined && perDayPrice !== "") updateFields.perDayPrice = Number(perDayPrice);
    if (perSecPrice !== undefined && perSecPrice !== "") updateFields.perSecPrice = Number(perSecPrice);
    if (baseView !== undefined && baseView !== "") updateFields.baseView = Number(baseView);
    if (perCityPrice !== undefined && perCityPrice !== "") updateFields.perCityPrice = Number(perCityPrice);
    if (adCommission !== undefined && adCommission !== "") updateFields.adCommission = Number(adCommission);

    // ✅ Only update withdraw amount if valid number
    if (withdrawAmount !== undefined && withdrawAmount !== "" && !isNaN(withdrawAmount)) {
      updateFields.minimumWithdrawAmountForReporter = Number(withdrawAmount);
    }

    const pricing = await AdPricing.findOneAndUpdate(
      {}, // condition (single global config)
      { $set: updateFields }, // only update non-empty fields
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: "Ad pricing updated", data: pricing });
  } catch (error) {
    console.error("Error in adminSetAdPrice:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



const fbVideoUpload = async (req, res) => {
  const { fbLink } = req.body;

  if (!fbLink) {
    return res.status(400).json({ success: false, message: "Link not uploaded" });
  }

  try {
    const updatedDoc = await AdPricing.findOneAndUpdate(
      {}, // match global singleton config
      { $set: { fbVideoUploadLink: fbLink } },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: "FB video link saved", data: updatedDoc });
  } catch (error) {
    console.error("Error in fbVideoUpload:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const acceptingAdTimeing = async (req, res)=>{

  const {hours} =req.body

  if (!hours || isNaN(hours) || Number(hours) <= 0) {
  return res.status(400).json({ success: false, message: "Valid time (in hours) must be provided" });
}

  try{
    const updateDoc = await AdPricing.findOneAndUpdate(
      {},
      {$set: {reporterAcceptTimeInHours: hours}},
      {new: true, upsert: true}
    );

    res.status(200).json({success: true, message: "Time is set successfully for accepting ads", data: updateDoc})
  }
  catch(error)
  {
    console.error("Error while adding accepting ad time");
    res.status(500).json({success: false, message: "Server error"})
  }

}

// Set reporter price for paid conferences
const setReporterPrice = async (req, res) => {
  try {
    const { price } = req.body;

    if (!price || isNaN(price) || Number(price) < 0) {
      return res.status(400).json({ success: false, message: "Valid price is required" });
    }

    const pricing = await AdPricing.findOneAndUpdate(
      {}, // condition (single global config)
      { $set: { reporterPrice: Number(price) } }, // update the reporter price
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: "Reporter price updated successfully", data: pricing });
  } catch (error) {
    console.error("Error in setReporterPrice:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Set paid conference commission percentage
const setPaidConferenceCommission = async (req, res) => {
  try {
    const { commission } = req.body;

    if (!commission || isNaN(commission) || Number(commission) < 0 || Number(commission) > 100) {
      return res.status(400).json({ success: false, message: "Valid commission percentage (0-100) is required" });
    }

    const pricing = await AdPricing.findOneAndUpdate(
      {}, // condition (single global config)
      { $set: { paidConferenceCommission: Number(commission) } }, // update the commission percentage
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: "Paid conference commission updated successfully", data: pricing });
  } catch (error) {
    console.error("Error in setPaidConferenceCommission:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};




module.exports = {adminSetAdPrice,fbVideoUpload, acceptingAdTimeing, setReporterPrice, setPaidConferenceCommission}
