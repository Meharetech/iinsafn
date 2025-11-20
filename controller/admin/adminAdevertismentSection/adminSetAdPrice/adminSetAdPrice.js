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
    console.log("📥 Received pricing data:", JSON.stringify(req.body, null, 2));

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
      withdrawAmount,
      maxAdLength,
      minAdLength
    } = req.body;

    // Build update object only with provided (non-undefined and non-empty) fields
    const updateFields = {};

    // ✅ Handle adType array - save if it's an array with items
    if (adType !== undefined && Array.isArray(adType) && adType.length > 0) {
      // Ensure each adType has required fields and valid data
      const validAdTypes = adType.filter(type => 
        type && 
        type.name && 
        type.name.trim() !== '' && 
        !isNaN(type.price) && 
        Number(type.price) >= 0
      ).map(type => ({
        id: type.id || Date.now() + Math.random(), // Generate ID if not provided
        name: type.name.trim(),
        price: Number(type.price)
      }));
      
      if (validAdTypes.length > 0) {
        updateFields.adType = validAdTypes;
      }
    }

    // ✅ Handle channelType array - save if it's an array with items
    if (channelType !== undefined && Array.isArray(channelType) && channelType.length > 0) {
      // Ensure each channelType has required fields
      const validChannelTypes = channelType.filter(type => 
        type && 
        type.name && 
        type.name.trim() !== ''
      ).map(type => ({
        id: type.id || Date.now() + Math.random(), // Generate ID if not provided
        name: type.name.trim()
      }));
      
      if (validChannelTypes.length > 0) {
        updateFields.channelType = validChannelTypes;
      }
    }

    // ✅ Handle plateforms array
    if (plateforms !== undefined && Array.isArray(plateforms) && plateforms.length > 0) {
      // Filter out empty strings and trim
      const validPlatforms = plateforms
        .filter(platform => platform && platform.trim() !== '')
        .map(platform => platform.trim());
      
      if (validPlatforms.length > 0) {
        updateFields.plateforms = validPlatforms;
      }
    }

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

    // ✅ Update ad length limits if provided
    if (maxAdLength !== undefined && maxAdLength !== "" && !isNaN(maxAdLength)) {
      updateFields.maxAdLength = Number(maxAdLength);
    }
    if (minAdLength !== undefined && minAdLength !== "" && !isNaN(minAdLength)) {
      updateFields.minAdLength = Number(minAdLength);
    }

    console.log("💾 Update fields to save:", JSON.stringify(updateFields, null, 2));

    const pricing = await AdPricing.findOneAndUpdate(
      {}, // condition (single global config)
      { $set: updateFields }, // only update non-empty fields
      { new: true, upsert: true }
    );

    console.log("✅ Pricing updated successfully. Saved adTypes:", pricing.adType?.length || 0);
    console.log("✅ Pricing updated successfully. Saved channelTypes:", pricing.channelType?.length || 0);

    res.status(200).json({ 
      success: true, 
      message: "Ad pricing updated successfully", 
      data: pricing 
    });
  } catch (error) {
    console.error("❌ Error in adminSetAdPrice:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while updating pricing",
      error: error.message 
    });
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




// ==================== AD TYPE MANAGEMENT APIs ====================

// Add new Ad Type
const addAdType = async (req, res) => {
  try {
    const { name, price } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: "Ad type name is required" 
      });
    }

    if (!price || isNaN(price) || Number(price) < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid price (>= 0) is required" 
      });
    }

    // Get current pricing document
    let pricing = await AdPricing.findOne();
    if (!pricing) {
      pricing = new AdPricing({});
    }

    // Check if ad type with same name already exists
    const existingAdType = pricing.adType?.find(
      type => type.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (existingAdType) {
      return res.status(400).json({ 
        success: false, 
        message: "Ad type with this name already exists" 
      });
    }

    // Generate unique ID
    const newId = Date.now() + Math.floor(Math.random() * 1000);

    // Add new ad type
    if (!pricing.adType) {
      pricing.adType = [];
    }

    pricing.adType.push({
      id: newId,
      name: name.trim(),
      price: Number(price)
    });

    await pricing.save();

    console.log("✅ Ad type added successfully:", { id: newId, name: name.trim(), price: Number(price) });

    res.status(201).json({ 
      success: true, 
      message: "Ad type added successfully", 
      data: {
        id: newId,
        name: name.trim(),
        price: Number(price)
      }
    });
  } catch (error) {
    console.error("❌ Error adding ad type:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while adding ad type",
      error: error.message 
    });
  }
};

// Edit existing Ad Type
const editAdType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price } = req.body;

    // Validation
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Ad type ID is required" 
      });
    }

    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: "Ad type name cannot be empty" 
      });
    }

    if (price !== undefined && (isNaN(price) || Number(price) < 0)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid price (>= 0) is required" 
      });
    }

    // Get current pricing document
    const pricing = await AdPricing.findOne();
    if (!pricing || !pricing.adType || pricing.adType.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Ad type not found" 
      });
    }

    // Find ad type by ID (handle both number and string IDs)
    const adTypeIndex = pricing.adType.findIndex(
      type => {
        const typeId = type.id?.toString() || type._id?.toString();
        const searchId = id.toString();
        return typeId === searchId || Number(typeId) === Number(searchId);
      }
    );

    if (adTypeIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Ad type not found" 
      });
    }

    // Check if new name conflicts with existing ad type (excluding current one)
    if (name) {
      const nameConflict = pricing.adType.find(
        (type, index) => 
          index !== adTypeIndex && 
          type.name.toLowerCase().trim() === name.toLowerCase().trim()
      );

      if (nameConflict) {
        return res.status(400).json({ 
          success: false, 
          message: "Ad type with this name already exists" 
        });
      }
    }

    // Update ad type
    if (name !== undefined) {
      pricing.adType[adTypeIndex].name = name.trim();
    }
    if (price !== undefined) {
      pricing.adType[adTypeIndex].price = Number(price);
    }

    await pricing.save();

    console.log("✅ Ad type updated successfully:", pricing.adType[adTypeIndex]);

    res.status(200).json({ 
      success: true, 
      message: "Ad type updated successfully", 
      data: pricing.adType[adTypeIndex]
    });
  } catch (error) {
    console.error("❌ Error editing ad type:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while editing ad type",
      error: error.message 
    });
  }
};

// Delete Ad Type
const deleteAdType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Ad type ID is required" 
      });
    }

    // Get current pricing document
    const pricing = await AdPricing.findOne();
    if (!pricing || !pricing.adType || pricing.adType.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Ad type not found" 
      });
    }

    // Find and remove ad type (handle both number and string IDs)
    const initialLength = pricing.adType.length;
    pricing.adType = pricing.adType.filter(
      type => {
        const typeId = type.id?.toString() || type._id?.toString();
        const searchId = id.toString();
        return typeId !== searchId && Number(typeId) !== Number(searchId);
      }
    );

    if (pricing.adType.length === initialLength) {
      return res.status(404).json({ 
        success: false, 
        message: "Ad type not found" 
      });
    }

    await pricing.save();

    console.log("✅ Ad type deleted successfully. ID:", id);

    res.status(200).json({ 
      success: true, 
      message: "Ad type deleted successfully",
      deletedId: id
    });
  } catch (error) {
    console.error("❌ Error deleting ad type:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while deleting ad type",
      error: error.message 
    });
  }
};

// ==================== CHANNEL TYPE MANAGEMENT APIs ====================

// Add new Channel Type
const addChannelType = async (req, res) => {
  try {
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: "Channel type name is required" 
      });
    }

    // Get current pricing document
    let pricing = await AdPricing.findOne();
    if (!pricing) {
      pricing = new AdPricing({});
    }

    // Check if channel type with same name already exists
    const existingChannelType = pricing.channelType?.find(
      type => type.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (existingChannelType) {
      return res.status(400).json({ 
        success: false, 
        message: "Channel type with this name already exists" 
      });
    }

    // Generate unique ID
    const newId = Date.now() + Math.floor(Math.random() * 1000);

    // Add new channel type
    if (!pricing.channelType) {
      pricing.channelType = [];
    }

    pricing.channelType.push({
      id: newId,
      name: name.trim()
    });

    await pricing.save();

    console.log("✅ Channel type added successfully:", { id: newId, name: name.trim() });

    res.status(201).json({ 
      success: true, 
      message: "Channel type added successfully", 
      data: {
        id: newId,
        name: name.trim()
      }
    });
  } catch (error) {
    console.error("❌ Error adding channel type:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while adding channel type",
      error: error.message 
    });
  }
};

// Edit existing Channel Type
const editChannelType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validation
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Channel type ID is required" 
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: "Channel type name is required" 
      });
    }

    // Get current pricing document
    const pricing = await AdPricing.findOne();
    if (!pricing || !pricing.channelType || pricing.channelType.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Channel type not found" 
      });
    }

    // Find channel type by ID (handle both number and string IDs)
    const channelTypeIndex = pricing.channelType.findIndex(
      type => {
        const typeId = type.id?.toString() || type._id?.toString();
        const searchId = id.toString();
        return typeId === searchId || Number(typeId) === Number(searchId);
      }
    );

    if (channelTypeIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Channel type not found" 
      });
    }

    // Check if new name conflicts with existing channel type (excluding current one)
    const nameConflict = pricing.channelType.find(
      (type, index) => 
        index !== channelTypeIndex && 
        type.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (nameConflict) {
      return res.status(400).json({ 
        success: false, 
        message: "Channel type with this name already exists" 
      });
    }

    // Update channel type
    pricing.channelType[channelTypeIndex].name = name.trim();

    await pricing.save();

    console.log("✅ Channel type updated successfully:", pricing.channelType[channelTypeIndex]);

    res.status(200).json({ 
      success: true, 
      message: "Channel type updated successfully", 
      data: pricing.channelType[channelTypeIndex]
    });
  } catch (error) {
    console.error("❌ Error editing channel type:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while editing channel type",
      error: error.message 
    });
  }
};

// Delete Channel Type
const deleteChannelType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Channel type ID is required" 
      });
    }

    // Get current pricing document
    const pricing = await AdPricing.findOne();
    if (!pricing || !pricing.channelType || pricing.channelType.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Channel type not found" 
      });
    }

    // Find and remove channel type (handle both number and string IDs)
    const initialLength = pricing.channelType.length;
    pricing.channelType = pricing.channelType.filter(
      type => {
        const typeId = type.id?.toString() || type._id?.toString();
        const searchId = id.toString();
        return typeId !== searchId && Number(typeId) !== Number(searchId);
      }
    );

    if (pricing.channelType.length === initialLength) {
      return res.status(404).json({ 
        success: false, 
        message: "Channel type not found" 
      });
    }

    await pricing.save();

    console.log("✅ Channel type deleted successfully. ID:", id);

    res.status(200).json({ 
      success: true, 
      message: "Channel type deleted successfully",
      deletedId: id
    });
  } catch (error) {
    console.error("❌ Error deleting channel type:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while deleting channel type",
      error: error.message 
    });
  }
};

module.exports = {
  adminSetAdPrice,
  fbVideoUpload, 
  acceptingAdTimeing, 
  setReporterPrice, 
  setPaidConferenceCommission,
  // Ad Type Management
  addAdType,
  editAdType,
  deleteAdType,
  // Channel Type Management
  addChannelType,
  editChannelType,
  deleteChannelType
}
