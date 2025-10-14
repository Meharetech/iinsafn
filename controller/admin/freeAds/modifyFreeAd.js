const freeAdModel = require("../../../models/adminModels/freeAds/freeAdsSchema");
const User = require("../../../models/userModel/userModel");
const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");
const notifyMatchingReporters = require("../../../utils/notifyMatchingReporters");
const mongoose = require("mongoose");

// ✅ Background notification processing function
const processNotificationsInBackground = async (ad) => {
  try {
    console.log(`🔄 Processing notifications for modified ad: ${ad._id}`);
    
    // Call notifyMatchingReporters without blocking
    await notifyMatchingReporters(ad);
    
    console.log(`✅ Completed background notifications for modified ad: ${ad._id}`);
  } catch (error) {
    console.error(`❌ Error in background notification process for modified ad ${ad._id}:`, error);
    // Don't throw error - this is background process
  }
};

const modifyFreeAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const {
      action,
      note,
      state,
      cities,
      reportersIds,
      influencersIds,
      allStatesTrue,
      userType,
    } = req.body;

    // 🔑 CRITICAL FIX: Add input validation
    if (!adId) {
      return res.status(400).json({
        success: false,
        message: "Advertisement ID is required",
      });
    }

    if (!userType || !['reporter', 'influencer', 'both'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Valid userType is required (reporter, influencer, or both)",
      });
    }

    // ✅ FIX: Validate and sanitize input data
    const hasSpecificUsersValidation = (reportersIds && reportersIds.length > 0) || (influencersIds && influencersIds.length > 0);
    const hasLocationTargeting = allStatesTrue || (state && state.trim() !== "") || (cities && cities.length > 0);
    
    if (!hasSpecificUsersValidation && !hasLocationTargeting) {
      return res.status(400).json({
        success: false,
        message: "Please provide either specific users or location targeting",
      });
    }

    // ✅ FIX: Validate ObjectId format for user IDs
    const validateObjectIds = (idsString) => {
      if (!idsString) return [];
      const ids = idsString.split(",").filter((id) => id.trim() !== "");
      const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id.trim()));
      if (invalidIds.length > 0) {
        throw new Error(`Invalid user IDs: ${invalidIds.join(", ")}`);
      }
      return ids.map(id => id.trim());
    };

    try {
      if (reportersIds) validateObjectIds(reportersIds);
      if (influencersIds) validateObjectIds(influencersIds);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    console.log(`🔧 Modifying free ad: ${adId}`);
    console.log(`📊 Modification data:`, {
      action,
      note,
      state,
      cities,
      reportersIds,
      influencersIds,
      allStatesTrue,
      userType,
    });

    // ✅ FIX: Use MongoDB transaction to prevent race conditions
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Find the free ad with better error handling
        const ad = await freeAdModel.findById(adId).session(session);
    if (!ad) {
          throw new Error("Free ad not found");
        }

        // Validate ad status - only allow modification of certain statuses
        if (!['approved', 'modified', 'running'].includes(ad.status)) {
          throw new Error(`Cannot modify ad with status: ${ad.status}. Only approved, modified, or running ads can be modified.`);
    }

    // Calculate new required users based on modification
    let requiredReporters = [];
    let requiredInfluencers = [];

        // CASE 1: Admin chose specific users - ONLY use these specific users
    if (reportersIds && reportersIds.length > 0) {
          const idsArray = validateObjectIds(reportersIds);
      requiredReporters = idsArray;
          console.log(`🎯 Admin selected specific reporters: ${idsArray.length} reporters`);
    }

    if (influencersIds && influencersIds.length > 0) {
          const idsArray = validateObjectIds(influencersIds);
      requiredInfluencers = idsArray;
          console.log(`🎯 Admin selected specific influencers: ${idsArray.length} influencers`);
        }

        // 🔑 CRITICAL FIX: If specific users are selected, DON'T query by location
        const hasSpecificUsersSelected = (requiredReporters.length > 0 || requiredInfluencers.length > 0);
        
        if (hasSpecificUsersSelected) {
          console.log(`🎯 Specific users selected - skipping location-based queries`);
          console.log(`📊 Selected Reporters: ${requiredReporters.length}, Selected Influencers: ${requiredInfluencers.length}`);
        } else {
          console.log(`🎯 No specific users selected - using location-based targeting`);

    // CASE 2: All users of selected type(s) in DB
    if (allStatesTrue === true) {
      if (userType === "reporter" || userType === "both") {
        const allReporters = await User.find({ 
          role: "Reporter", 
          verifiedReporter: true 
              }, "_id").session(session);
        requiredReporters = allReporters.map((r) => r._id.toString());
        console.log(`📊 Found ${allReporters.length} verified reporters for all states`);
      }
      if (userType === "influencer" || userType === "both") {
        const allInfluencers = await User.find({ 
          role: "Influencer", 
          isVerified: true 
              }, "_id").session(session);
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
              ).session(session);
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
              ).session(session);
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
              ).session(session);
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
              ).session(session);
        requiredInfluencers = influencersInState.map((r) => r._id.toString());
        console.log(`📊 Found ${influencersInState.length} verified influencers in state: ${state}`);
            }
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

    console.log(`📊 Final targeting: ${allRequiredUsers.length} total users`);
    console.log(`📊 Reporters: ${requiredReporters.length}, Influencers: ${requiredInfluencers.length}`);

    // Update the ad with new targeting - PRESERVE EXISTING + ADD NEW
    ad.state = state ? [state] : [];
    ad.city = cities ? cities.split(",") : [];
    
    // 🔑 CRITICAL FIX: Preserve existing targeting and add new targeting
    const existingReportersIds = ad.reportersIds || [];
    const existingInfluencersIds = ad.influencersIds || [];
    
    // Combine existing + new targeting (remove duplicates)
    const combinedReportersIds = [...new Set([...existingReportersIds.map(id => id.toString()), ...requiredReporters.map(id => id.toString())])];
    const combinedInfluencersIds = [...new Set([...existingInfluencersIds.map(id => id.toString()), ...requiredInfluencers.map(id => id.toString())])];
    
    // ✅ NEW FEATURE: Identify NEWLY ADDED users (not already targeted)
    const existingTargetedUsers = [...existingReportersIds.map(id => id.toString()), ...existingInfluencersIds.map(id => id.toString())];
    const newlyAddedReporters = requiredReporters.filter(id => !existingTargetedUsers.includes(id.toString()));
    const newlyAddedInfluencers = requiredInfluencers.filter(id => !existingTargetedUsers.includes(id.toString()));
    
    console.log(`📊 NEWLY ADDED USERS:`);
    console.log(`📊 New Reporters: ${newlyAddedReporters.length}, New Influencers: ${newlyAddedInfluencers.length}`);
    console.log(`📊 New Reporters IDs: ${newlyAddedReporters.join(', ')}`);
    console.log(`📊 New Influencers IDs: ${newlyAddedInfluencers.join(', ')}`);
    
    // Update arrays with combined targeting
    ad.reportersIds = combinedReportersIds;
    ad.influencersIds = combinedInfluencersIds;
    ad.selectedReporters = [...new Set([...combinedReportersIds, ...combinedInfluencersIds])];
    ad.requiredReportersCount = ad.selectedReporters.length;
    ad.allState = !!allStatesTrue;
    // 🔑 CRITICAL FIX: Set userType to "both" if we have both reporters and influencers
    if (combinedReportersIds.length > 0 && combinedInfluencersIds.length > 0) {
      ad.userType = "both";
      console.log(`🎯 userType set to "both" - has both reporters and influencers`);
    } else if (combinedReportersIds.length > 0) {
      ad.userType = "reporter";
      console.log(`🎯 userType set to "reporter" - only reporters targeted`);
    } else if (combinedInfluencersIds.length > 0) {
      ad.userType = "influencer";
      console.log(`🎯 userType set to "influencer" - only influencers targeted`);
    } else {
      ad.userType = userType; // Fallback to original userType
    }
    ad.status = "modified";
    ad.modifiedAt = new Date();
    
    console.log(`📊 PRESERVED + NEW TARGETING:`);
    console.log(`📊 Existing Reporters: ${existingReportersIds.length}, New Reporters: ${requiredReporters.length}, Combined: ${combinedReportersIds.length}`);
    console.log(`📊 Existing Influencers: ${existingInfluencersIds.length}, New Influencers: ${requiredInfluencers.length}, Combined: ${combinedInfluencersIds.length}`);
    console.log(`📊 Total Selected Users: ${ad.selectedReporters.length}`);

        // ✅ CRITICAL FIX: PRESERVE ALL EXISTING USERS - NO RESETTING
        // Keep all existing users' statuses and proofs intact
        if (ad.acceptedReporters && ad.acceptedReporters.length > 0) {
          console.log(`🔄 Processing ${ad.acceptedReporters.length} existing reporters for modification`);
          
          ad.acceptedReporters.forEach(reporter => {
            const reporterId = reporter.reporterId.toString();
            const isStillTargeted = ad.selectedReporters.includes(reporterId);
            
            if (isStillTargeted) {
              // ✅ User is still targeted - preserve their status and proofs
              console.log(`✅ Preserving status for reporter ${reporterId}: ${reporter.postStatus}`);
              // Keep all existing data intact
            } else {
              // ✅ User is no longer targeted - BUT PRESERVE THEIR STATUS
              console.log(`✅ Preserving status for removed reporter ${reporterId}: ${reporter.postStatus} - NO RESET`);
              // Keep all existing data intact - NO CHANGES
            }
          });
        }

        // ✅ NEW FEATURE: Check for users who are being added again but have existing proofs
        // If a user is being added again and they have completed/submitted proofs, preserve their status
        const existingProofs = await FreeAdProof.find({ adId: ad._id }).session(session);
        console.log(`🔍 Found ${existingProofs.length} existing proof records for ad ${ad._id}`);
        
        // ✅ FIX: Optimize database queries - batch fetch all users at once
        const userIds = ad.selectedReporters;
        const users = await User.find({ _id: { $in: userIds } }).session(session);
        const userMap = new Map(users.map(u => [u._id.toString(), u]));
        
        // Create a map of existing proof statuses by reporterId
        const existingProofStatuses = {};
        existingProofs.forEach(proof => {
          existingProofStatuses[proof.reporterId.toString()] = proof.status;
        });
        
        // Check if any newly added users have existing proofs
        for (const reporterId of ad.selectedReporters) {
          const existingStatus = existingProofStatuses[reporterId];
          
          if (existingStatus && ['submitted', 'approved', 'completed'].includes(existingStatus)) {
            // ✅ User has existing proof - check if they're in acceptedReporters
            const existingReporter = ad.acceptedReporters.find(r => r.reporterId.toString() === reporterId);
            
            if (existingReporter) {
              // ✅ User already in acceptedReporters - preserve their status
              console.log(`✅ User ${reporterId} already in acceptedReporters with status: ${existingReporter.postStatus}`);
            } else {
              // ✅ User has existing proof but not in acceptedReporters - add them with preserved status
              console.log(`✅ Adding user ${reporterId} with existing proof status: ${existingStatus}`);
              
              // ✅ FIX: Use userMap instead of individual database query
              const user = userMap.get(reporterId);
              if (user) {
                // ✅ FIX: Correct status mapping
                let mappedStatus;
                if (existingStatus === 'completed') {
                  mappedStatus = 'completed';
                } else if (existingStatus === 'approved') {
                  mappedStatus = 'approved'; // ✅ FIX: Keep approved as approved
                } else {
                  mappedStatus = 'submitted';
                }
                
                ad.acceptedReporters.push({
                  reporterId: user._id,
                  iinsafId: user.iinsafId,
                  postStatus: mappedStatus,
                  accepted: true,
                  adProof: true,
                  acceptedAt: new Date(),
                  submittedAt: existingStatus === 'submitted' ? new Date() : null,
                  completedAt: existingStatus === 'completed' ? new Date() : null,
                  userRole: user.role === "Influencer" ? "Influencer" : "Reporter"
                });
                console.log(`✅ Added user ${reporterId} with preserved status: ${existingStatus} → ${mappedStatus}`);
              }
            }
          }
        }

        // ✅ CRITICAL FIX: PRESERVE ALL PROOF RECORDS - NO DELETION
        // Keep all existing proof records intact regardless of targeting
        try {
          console.log(`🔍 Processing ${existingProofs.length} existing proof records for ad ${ad._id}`);
          
          for (const proof of existingProofs) {
            const reporterId = proof.reporterId.toString();
            const isStillTargeted = ad.selectedReporters.includes(reporterId);
            
            if (!isStillTargeted) {
              // ✅ User is no longer targeted - BUT PRESERVE THEIR PROOF RECORD
              console.log(`✅ Preserving proof record for removed reporter ${reporterId} (proof status: ${proof.status}) - NO DELETION`);
              // Keep all existing proof records intact - NO CHANGES
            } else {
              // ✅ User is still targeted - preserve their proof record
              console.log(`✅ Preserving proof record for reporter ${reporterId} (proof status: ${proof.status})`);
            }
          }
        } catch (proofError) {
          console.error(`❌ Error processing proof records:`, proofError);
          throw proofError; // ✅ FIX: Re-throw error to abort transaction
        }

        // ✅ FIX: Save with session for transaction consistency
        await ad.save({ session });

    console.log(`✅ Free ad updated successfully: ${ad._id}`);
      }); // End of transaction
      
    } catch (transactionError) {
      console.error("❌ Transaction failed:", transactionError);
      return res.status(500).json({
        success: false,
        message: "Failed to modify free ad due to transaction error",
        error: transactionError.message,
      });
    } finally {
      await session.endSession();
    }

    // ✅ FIX: Fetch ad again after transaction to get updated data
    const updatedAd = await freeAdModel.findById(adId);
    
    // ✅ NEW FEATURE: Re-calculate newly added users for notifications
    const existingReportersIds = updatedAd.reportersIds || [];
    const existingInfluencersIds = updatedAd.influencersIds || [];
    const existingTargetedUsers = [...existingReportersIds.map(id => id.toString()), ...existingInfluencersIds.map(id => id.toString())];
    
    // Calculate newly added users based on the final targeting
    const newlyAddedReporters = (updatedAd.reportersIds || []).filter(id => !existingTargetedUsers.includes(id.toString()));
    const newlyAddedInfluencers = (updatedAd.influencersIds || []).filter(id => !existingTargetedUsers.includes(id.toString()));
    
    console.log(`📊 FINAL NEWLY ADDED USERS FOR NOTIFICATIONS:`);
    console.log(`📊 New Reporters: ${newlyAddedReporters.length}, New Influencers: ${newlyAddedInfluencers.length}`);
    
    // ✅ NEW FEATURE: Create a modified ad object with ONLY newly added users for notifications
    const adForNotifications = {
      ...updatedAd.toObject(),
      // Only include newly added users for notifications
      reportersIds: newlyAddedReporters,
      influencersIds: newlyAddedInfluencers,
      selectedReporters: [...newlyAddedReporters, ...newlyAddedInfluencers],
      // Clear location targeting to force specific user targeting
      state: [],
      city: [],
      allState: false
    };

    // Use notifyMatchingReporters to create initial records and send notifications
    console.log(`📧 Creating initial records and sending notifications for modified ad`);
    console.log(`🔍 About to call notifyMatchingReporters with ONLY NEWLY ADDED users:`, {
      _id: adForNotifications._id,
      adType: adForNotifications.adType,
      userType: adForNotifications.userType,
      reportersIds: adForNotifications.reportersIds,
      influencersIds: adForNotifications.influencersIds,
      state: adForNotifications.state,
      city: adForNotifications.city,
      allState: adForNotifications.allState,
      newlyAddedCount: adForNotifications.selectedReporters.length
    });
    
    // ✅ FIX: Add timeout for background processing
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Notification timeout')), 30000)
    );
    
    // Process notifications in background to avoid blocking
    Promise.race([
      processNotificationsInBackground(adForNotifications),
      timeoutPromise
    ]).catch(error => {
      console.error(`❌ Background notification error for modified ad ${updatedAd._id}:`, error);
    });
    
    console.log(`✅ Background notification process started for ad: ${updatedAd._id}`);

    res.status(200).json({
      success: true,
      message: "Free ad modified successfully",
      data: updatedAd,
    });

  } catch (error) {
    console.error("Error modifying free ad:", error);
    res.status(500).json({
      success: false,
      message: "Server error while modifying free ad",
      error: error.message,
    });
  }
};

module.exports = modifyFreeAd;
