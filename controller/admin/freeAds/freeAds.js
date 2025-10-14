const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const User = require("../../../models/userModel/userModel");
const fs = require("fs");
const uploadToCloudinary = require("../../../utils/uploadToCloudinary");
const sendEmail = require("../../../utils/sendEmail");
const notifyOnWhatsapp = require("../../../utils/notifyOnWhatsapp");
const Templates = require("../../../utils/whatsappTemplates");
const notifyMatchingReporters = require("../../../utils/notifyMatchingReporters");
const mongoose = require('mongoose');

// Safe delete utility
const safeDeleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Error deleting file:", err.message);
    }
  } else {
    console.warn("File not found for deletion:", filePath);
  }
};

const freeAds = async (req, res) => {
  try {
    const {
      adType,
      mediaType,
      description,
      state,
      cities,
      reportersIds,
      influencersIds,
      allStatesTrue,
      userType,
    } = req.body;

    // ✅ Validate input
    if (
      !state &&
      (!cities || cities.length === 0) &&
      (!reportersIds || reportersIds.length === 0) &&
      (!influencersIds || influencersIds.length === 0) &&
      !allStatesTrue
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one of state, cities, reportersIds, influencersIds, or allStatesTrue must be provided.",
      });
    }

    // ✅ Validate userType
    if (!userType || !["reporter", "influencer", "both"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "userType must be either 'reporter', 'influencer', or 'both'.",
      });
    }

    let imageUrl = "";
    let videoUrl = "";

    // ✅ Upload image
    if (mediaType === "image" && req.files?.image?.[0]) {
      const image = req.files.image[0];
      const uploadedImage = await uploadToCloudinary(image.path, "image");
      imageUrl = uploadedImage.secure_url;
      safeDeleteFile(image.path);
    }

    // ✅ Upload video
    if (mediaType === "video" && req.files?.video?.[0]) {
      const video = req.files.video[0];
      const uploadedVideo = await uploadToCloudinary(video.path, "video");
      videoUrl = uploadedVideo.secure_url;
      safeDeleteFile(video.path);
    }

    // ================================
    // ✅ Calculate required users (reporters and influencers)
    // ================================
    let requiredReporters = [];
    let requiredInfluencers = [];

    // CASE 1: Admin chose specific users
    if (reportersIds && reportersIds.length > 0) {
      const idsArray = reportersIds.split(",").filter((id) => id.trim() !== "");
      requiredReporters = idsArray;
    }

    if (influencersIds && influencersIds.length > 0) {
      const idsArray = influencersIds.split(",").filter((id) => id.trim() !== "");
      requiredInfluencers = idsArray;
    }

    // CASE 2: All users of selected type(s) in DB
    if (allStatesTrue === true) {
      if (userType === "reporter" || userType === "both") {
        const allReporters = await User.find({ 
          role: "Reporter", 
          verifiedReporter: true 
        }, "_id");
        requiredReporters = allReporters.map((r) => r._id.toString());
        console.log(`📊 Found ${allReporters.length} verified reporters for all states`);
      }
      if (userType === "influencer" || userType === "both") {
        const allInfluencers = await User.find({ 
          role: "Influencer", 
          isVerified: true 
        }, "_id");
        requiredInfluencers = allInfluencers.map((r) => r._id.toString());
        console.log(`📊 Found ${allInfluencers.length} verified influencers for all states`);
      }
    }

    // CASE 3: Users of selected type(s) in selected cities
    else if (cities && cities.length > 0) {
      const citiesArray = cities.split(",").map((c) => c.trim());
      
      if (userType === "reporter" || userType === "both") {
        const reportersInCities = await User.find(
          { 
            role: "Reporter", 
            city: { $in: citiesArray },
            verifiedReporter: true 
          },
          "_id"
        );
        requiredReporters = reportersInCities.map((r) => r._id.toString());
        console.log(`📊 Found ${reportersInCities.length} verified reporters in cities: ${citiesArray.join(', ')}`);
      }
      
      if (userType === "influencer" || userType === "both") {
        const influencersInCities = await User.find(
          { 
            role: "Influencer", 
            city: { $in: citiesArray },
            isVerified: true 
          },
          "_id"
        );
        requiredInfluencers = influencersInCities.map((r) => r._id.toString());
        console.log(`📊 Found ${influencersInCities.length} verified influencers in cities: ${citiesArray.join(', ')}`);
      }
    }

    // CASE 4: Users of selected type(s) in selected state
    else if (state && state.trim() !== "") {
      if (userType === "reporter" || userType === "both") {
        const reportersInState = await User.find(
          { 
            role: "Reporter", 
            state: state.trim(),
            verifiedReporter: true 
          },
          "_id"
        );
        requiredReporters = reportersInState.map((r) => r._id.toString());
        console.log(`📊 Found ${reportersInState.length} verified reporters in state: ${state}`);
      }
      
      if (userType === "influencer" || userType === "both") {
        const influencersInState = await User.find(
          { 
            role: "Influencer", 
            state: state.trim(),
            isVerified: true 
          },
          "_id"
        );
        requiredInfluencers = influencersInState.map((r) => r._id.toString());
        console.log(`📊 Found ${influencersInState.length} verified influencers in state: ${state}`);
      }
    }

    // CRITICAL FIX: Clear arrays based on userType to prevent sending to wrong users
    if (userType === "reporter") {
      // If userType is reporter, clear influencers array
      requiredInfluencers = [];
      console.log(`🎯 userType is "reporter" - cleared influencers array`);
    } else if (userType === "influencer") {
      // If userType is influencer, clear reporters array
      requiredReporters = [];
      console.log(`🎯 userType is "influencer" - cleared reporters array`);
    } else if (userType === "both") {
      // If userType is both, keep both arrays as they are
      console.log(`🎯 userType is "both" - keeping both arrays`);
      console.log(`📊 Reporters array length: ${requiredReporters.length}`);
      console.log(`📊 Influencers array length: ${requiredInfluencers.length}`);
    }

    // Combine all required users
    const allRequiredUsers = [...requiredReporters, ...requiredInfluencers];
    const requiredReportersCount = allRequiredUsers.length;

    // ================================
    // ✅ Save ad in DB
    // ================================
    let newFreeAd;
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      newFreeAd = new freeAdModel({
        adType,
        mediaType,
        description,
        imageUrl,
        videoUrl,
        state: state ? [state] : [],
        city: cities ? cities.split(",") : [],
        selectedReporters: allRequiredUsers, // store all targeted users (reporters + influencers)
        requiredReportersCount, // store calculated number
        acceptedReporters: [], // no one has accepted yet
        allState: !!allStatesTrue, // store flag if needed
        userType, // store the target user type
        // Store separate arrays for tracking
        reportersIds: requiredReporters,
        influencersIds: requiredInfluencers,
        status: "approved", // Set initial status
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newFreeAd.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // ✅ IMMEDIATE RESPONSE - Don't wait for notifications
    res.status(201).json({
      success: true,
      message: "Free ad posted successfully! Notifications are being sent in the background.",
      data: newFreeAd,
    });

    // ✅ PROCESS NOTIFICATIONS ASYNCHRONOUSLY (Don't await)
    console.log(`🚀 Starting background notification process for ad: ${newFreeAd._id}`);
    console.log(`📊 Targeted users: ${allRequiredUsers.length} total`);
    console.log(`📊 Reporters: ${requiredReporters.length}, Influencers: ${requiredInfluencers.length}`);
    
    // Process notifications in background (fire and forget)
    processNotificationsInBackground(newFreeAd).catch(error => {
      console.error(`❌ Background notification error for ad ${newFreeAd._id}:`, error);
    });
  } catch (err) {
    console.error("Error in freeAds controller:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error while posting free ad" });
  }
};

// ✅ Background notification processing function
const processNotificationsInBackground = async (ad) => {
  try {
    console.log(`🔄 Processing notifications for ad: ${ad._id}`);
    
    // Call notifyMatchingReporters without blocking
    await notifyMatchingReporters(ad);
    
    console.log(`✅ Completed background notifications for ad: ${ad._id}`);
  } catch (error) {
    console.error(`❌ Error in background notification process for ad ${ad._id}:`, error);
    // Don't throw error - this is background process
  }
};

module.exports = freeAds;
