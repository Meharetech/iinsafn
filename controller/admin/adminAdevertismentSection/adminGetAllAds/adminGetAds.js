const fs = require("fs"); // for createWriteStream
const fsp = require("fs").promises; // for async file operations
const path = require("path");
const mongoose = require("mongoose"); // ✅ Add mongoose for transactions

const Adpost = require("../../../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../../../models/reporterAdProof/reporterAdProof");
const notifyMatchingReporters = require("../../../../utils/notifyMatchingReporters");
const Wallet = require("../../../../models/Wallet/walletSchema");
const axios = require("axios");
const getLiveViews = require("../../../../utils/getLiveViews");
const AdPricing = require("../../../../models/adminModels/advertismentPriceSet/adPricingSchema");
const applyWatermark = require("../../../../utils/applyWatermark");
const uploadToCloudinary = require("../../../../utils/uploadToCloudinary");
const sendEmail = require("../../../../utils/sendEmail");
const User = require("../../../../models/userModel/userModel");
const notifyOnWhatsapp = require("../../../../utils/notifyOnWhatsapp");
const Templates = require("../../../../utils/whatsappTemplates");
const RefundLog = require("../../../../models/WithdrawalRequest/refundLogSchema");

const adminGetAds = async (req, res) => {
  try {
    const ads = await Adpost.find()
      .populate('owner', 'name email organization mobile iinsafId role') // Populate owner with user details
      .sort({ createdAt: -1 }); // optional: latest ads first
    
    console.log(`📊 Fetched ${ads.length} advertisements with owner details`);
    res.status(200).json(ads);
  } catch (error) {
    console.error("Error fetching ads:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch advertisements" });
  }
};

// ✅ Download remote file with improved error handling
const downloadFile = async (fileUrl, outputLocationPath) => {
  try {
    console.log(`📥 Downloading file from: ${fileUrl}`);
    console.log(`💾 Saving to: ${outputLocationPath}`);
    
    const writer = fs.createWriteStream(outputLocationPath);
    
    const response = await axios({
      url: fileUrl,
      method: "GET",
      responseType: "stream",
      timeout: 30000, // 30 second timeout
      maxContentLength: 100 * 1024 * 1024, // 100MB max file size
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        writer.close();
        console.log(`✅ File downloaded successfully: ${outputLocationPath}`);
        resolve();
      });
      writer.on("error", (err) => {
        console.error(`❌ Writer error for ${outputLocationPath}:`, err);
        reject(err);
      });
      response.data.on("error", (err) => {
        console.error(`❌ Response error for ${fileUrl}:`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`❌ Download failed for ${fileUrl}:`, error.message);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

// ✅ Background notification processing (non-blocking)
const processNotificationsInBackground = async (ad) => {
  try {
    console.log(`🚀 Starting background notification process for ad: ${ad._id}`);
    
    // Notify reporters
    await notifyMatchingReporters(ad);
    
    // Notify advertiser
    const advertiser = await User.findById(ad.owner);
    if (advertiser) {
      await sendEmail(
        advertiser.email,
        "✅ Your Ad is Approved",
        `Hello ${advertiser.name}, your advertisement "${ad.adType}" targeting ${ad.userType === 'influencer' ? 'Influencers' : 'Reporters'} has been approved and will be published soon.`
      );

      // 📱 WhatsApp
      await notifyOnWhatsapp(
        advertiser.mobile,
        Templates.NOTIFY_TO_ADVERTISER_AFTER_AD_APPROVED,
        [advertiser.name, ad.adType]
      );
    }
    
    console.log(`✅ Background notifications completed for ad: ${ad._id}`);
  } catch (error) {
    console.error(`❌ Background notification error for ad ${ad._id}:`, error);
    // Don't throw error - this is background process
  }
};

const approvedAds = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const adId = req.params.id;
    const ad = await Adpost.findById(adId)
      .populate('owner', 'name email organization mobile iinsafId role')
      .session(session);
      
    if (!ad) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Advertisement not found" });
    }

    const pricing = await AdPricing.findOne({
      adType: { $elemMatch: { name: ad.adType } },
    });

    if (!pricing || !pricing.reporterAcceptTimeInHours) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: "Reporter accept time not set in AdPricing",
      });
    }

    const approvedAt = new Date();
    const acceptBefore = new Date(
      approvedAt.getTime() + pricing.reporterAcceptTimeInHours * 60 * 60 * 1000
    );

    const tempFolder = path.join(__dirname, "../../tempAds");
    await fsp.mkdir(tempFolder, { recursive: true });

    let updatedImageUrl = ad.imageUrl;
    let updatedVideoUrl = ad.videoUrl;

    // ✅ Process Image
    if (ad.imageUrl) {
      const tempImagePath = path.join(tempFolder, `${Date.now()}_image.png`);
      await downloadFile(ad.imageUrl, tempImagePath);
      const watermarkedImage = await applyWatermark(tempImagePath, "image", {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 85,
        cropToFit: true
      });
      const uploadImage = await uploadToCloudinary(
        watermarkedImage,
        "ads/images"
      );
      updatedImageUrl = uploadImage.secure_url;

      // Delete temp files safely
      await fsp.unlink(tempImagePath).catch(() => {});
      await fsp.unlink(watermarkedImage).catch(() => {});
    }

    // ✅ Process Video
    if (ad.videoUrl) {
      const tempVideoPath = path.join(tempFolder, `${Date.now()}_video.mp4`);
      await downloadFile(ad.videoUrl, tempVideoPath);
      const watermarkedVideo = await applyWatermark(tempVideoPath, "video");
      const uploadVideo = await uploadToCloudinary(
        watermarkedVideo,
        "ads/videos"
      );
      updatedVideoUrl = uploadVideo.secure_url;

      await fsp.unlink(tempVideoPath).catch(() => {});
      await fsp.unlink(watermarkedVideo).catch(() => {});
    }

    // ✅ Update ad with transaction
    ad.status = "approved";
    ad.approvedAt = approvedAt;
    ad.acceptBefore = acceptBefore;
    ad.imageUrl = updatedImageUrl;
    ad.videoUrl = updatedVideoUrl;
    await ad.save({ session });

    await session.commitTransaction();

    // ✅ IMMEDIATE RESPONSE - Don't wait for notifications
    res.json({
      success: true,
      message: "Advertisement approved and processed successfully! Notifications are being sent in the background.",
      advertisement: ad,
    });

    // ✅ PROCESS NOTIFICATIONS ASYNCHRONOUSLY (Don't await)
    console.log(`🚀 Starting background notification process for ad: ${ad._id}`);
    processNotificationsInBackground(ad);
    
  } catch (err) {
    await session.abortTransaction();
    console.error("Error approving ad:", err);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
};



const adminModifyAds = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { adId } = req.params;
    const {
      adminSelectState,
      adminSelectCities,
      adminSelectPincode,
      reporterId,
      allStates,
      userType,
    } = req.body;

    const ad = await Adpost.findById(adId)
      .populate('owner', 'name email organization mobile iinsafId role')
      .session(session);
      
    if (!ad) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Advertisement not found" });
    }

    const pricing = await AdPricing.findOne({
      adType: { $elemMatch: { name: ad.adType } },
    });
    if (!pricing || !pricing.reporterAcceptTimeInHours) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: "Reporter accept time not set in AdPricing",
      });
    }

    const approvedAt = new Date();
    const acceptBefore = new Date(
      approvedAt.getTime() + pricing.reporterAcceptTimeInHours * 60 * 60 * 1000
    );

    // ✅ Ensure temp folder exists
    const tempFolder = path.join(__dirname, "../../tempAds");
    await fsp.mkdir(tempFolder, { recursive: true });

    // 🔧 Apply watermark if media exists
    let updatedImageUrl = ad.imageUrl;
    let updatedVideoUrl = ad.videoUrl;

    if (ad.imageUrl && ad.imageUrl.trim() !== '') {
      try {
        console.log(`🖼️ Processing image: ${ad.imageUrl}`);
        const tempImagePath = path.join(tempFolder, `${Date.now()}_image.png`);
        await downloadFile(ad.imageUrl, tempImagePath);
        
        const watermarkedImage = await applyWatermark(tempImagePath, "image", {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 85,
          cropToFit: true
        });
        const uploadImage = await uploadToCloudinary(
          watermarkedImage,
          "ads/images"
        );
        
        if (uploadImage && uploadImage.secure_url) {
          updatedImageUrl = uploadImage.secure_url;
          console.log(`✅ Image watermarked and uploaded: ${updatedImageUrl}`);
        } else {
          console.warn(`⚠️ Image upload failed, keeping original: ${ad.imageUrl}`);
        }

        // Clean up temp files
        await fsp.unlink(tempImagePath).catch(() => {});
        await fsp.unlink(watermarkedImage).catch(() => {});
      } catch (imageError) {
        console.error(`❌ Image processing failed:`, imageError.message);
        console.log(`🔄 Keeping original image URL: ${ad.imageUrl}`);
        // Keep original image URL if processing fails
      }
    }

    if (ad.videoUrl && ad.videoUrl.trim() !== '') {
      try {
        console.log(`🎥 Processing video: ${ad.videoUrl}`);
        const tempVideoPath = path.join(tempFolder, `${Date.now()}_video.mp4`);
        await downloadFile(ad.videoUrl, tempVideoPath);
        
        const watermarkedVideo = await applyWatermark(tempVideoPath, "video");
        const uploadVideo = await uploadToCloudinary(
          watermarkedVideo,
          "ads/videos"
        );
        
        if (uploadVideo && uploadVideo.secure_url) {
          updatedVideoUrl = uploadVideo.secure_url;
          console.log(`✅ Video watermarked and uploaded: ${updatedVideoUrl}`);
        } else {
          console.warn(`⚠️ Video upload failed, keeping original: ${ad.videoUrl}`);
        }

        // Clean up temp files
        await fsp.unlink(tempVideoPath).catch(() => {});
        await fsp.unlink(watermarkedVideo).catch(() => {});
      } catch (videoError) {
        console.error(`❌ Video processing failed:`, videoError.message);
        console.log(`🔄 Keeping original video URL: ${ad.videoUrl}`);
        // Keep original video URL if processing fails
      }
    }

    // ✅ Update ad fields
    ad.adminSelectState = adminSelectState;
    ad.adminSelectCities = adminSelectCities;
    ad.adminSelectPincode = adminSelectPincode;
    ad.reporterId = reporterId;
    ad.allStates = allStates;
    ad.userType = userType || "reporter"; // ✅ Set userType based on selected users
    ad.status = "modified"; // ✅ Set status to "modified" when advertisement is modified
    ad.approvedAt = approvedAt;
    ad.acceptBefore = acceptBefore;
    ad.imageUrl = updatedImageUrl;
    ad.videoUrl = updatedVideoUrl;
    
    // ✅ Reset all reporter statuses to "pending" when advertisement is modified
    if (ad.acceptRejectReporterList && ad.acceptRejectReporterList.length > 0) {
      console.log(`🔄 Resetting ${ad.acceptRejectReporterList.length} reporter statuses to "pending" for modified ad`);
      ad.acceptRejectReporterList.forEach(reporter => {
        reporter.postStatus = "pending";
        reporter.accepted = false;
        reporter.adProof = false;
        reporter.rejectNote = "";
        reporter.rejectedAt = null;
        reporter.acceptedAt = null;
        reporter.submittedAt = null;
        reporter.completedAt = null;
      });
    }
    
    // Note: updatedAt will be automatically set by mongoose timestamps

    await ad.save({ session });
    await session.commitTransaction();

    // ✅ IMMEDIATE RESPONSE - Don't wait for notifications
    res.json({
      success: true,
      message: "Advertisement modified successfully! Notifications are being sent in the background.",
      advertisement: ad,
    });

    // ✅ PROCESS NOTIFICATIONS ASYNCHRONOUSLY (Don't await)
    console.log(`🚀 Starting background notification process for modified ad: ${ad._id}`);
    processNotificationsInBackground(ad);

    // 📤 Facebook upload (optional, uncomment if needed)
    // const uploadApi = process.env.FACEBOOK_UPLOAD_VIDEO;
    let fbUploadStatus = "not attempted";
    // try {
    //   if (updatedVideoUrl) await axios.post(uploadApi, { url: updatedVideoUrl });
    //   else if (updatedImageUrl) await axios.post(uploadApi, { url: updatedImageUrl });
    //   fbUploadStatus = "success";
    // } catch (fbError) {
    //   console.error("Facebook upload error:", fbError.message || fbError);
    //   fbUploadStatus = "failed";
    // }

  } catch (error) {
    await session.abortTransaction();
    console.error("Admin ad update error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    session.endSession();
  }
};

const generateRefundId = () => {
  const prefix = "REFUND";
  const uniquePart =
    Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  return `${prefix}-${uniquePart.toUpperCase()}`;
};

const rejectedAds = async (req, res) => {
  try {
    const { adminRejectNote } = req.body;

    // 1. Update ad
    const ad = await Adpost.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", adminRejectNote },
      { new: true }
    );

    if (!ad) {
      return res
        .status(404)
        .json({ success: false, message: "Advertisement not found" });
    }

    const advertiserId = ad.owner; // ObjectId
    const refundAmount = ad.totalCost || 0;

    if (!advertiserId || refundAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ad payment info" });
    }

    // 2. Generate refundId
    const refundId = generateRefundId();

    // 3. Find or create wallet
    let wallet = await Wallet.findOne({
      userId: advertiserId,
      userType: "Advertiser",
    });
    if (!wallet) {
      wallet = new Wallet({
        userId: advertiserId,
        userType: "Advertiser",
        balance: 0,
      });
    }

    // 4. Refund transaction
    wallet.balance = Number(wallet.balance || 0) + Number(refundAmount);
    wallet.transactions.push({
      type: "credit",
      amount: refundAmount,
      description: `Refund for rejected ad: ${ad._id}`,
      refundId,
      status: "success",
    });

    await wallet.save();

    // 5. Save Refund Log (for admin view)
    const advertiser = await User.findById(ad.owner);
    await RefundLog.create({
      refundId,
      adId: ad._id,
      advertiserId: advertiser?._id,            // ✅ store ObjectId
      advertiserCustomId: advertiser?.iinsafId, // ✅ new field for custom ID
      advertiserName: advertiser?.name,
      refundAmount,
      reason: ad.adminRejectNote || "Not specified",
    });

    // 6. Notify advertiser
    if (advertiser) {
      if (advertiser.email) {
        await sendEmail(
          advertiser.email,
          "❌ Your Ad was Rejected",
          `Hello ${advertiser.name}, unfortunately your advertisement "${
            ad.adType
          }" was rejected.\nReason: ${
            ad.adminRejectNote || "Not specified"
          }.\nRefund ID: ${refundId}\nA refund of ₹${refundAmount} has been credited to your wallet.`
        );
      }

      if (advertiser.mobile) {
        await notifyOnWhatsapp(
          advertiser.mobile,
          Templates.NOTIFY_TO_ADVERTISER_AFTER_AD_REJECTED_BY_ADMIN,
          [
            advertiser.name, // {{1}}
            ad.adType, // {{2}}
            ad.adminRejectNote || "Not specified", // {{3}}
            refundAmount, // {{4}}
            refundId, // {{5}}
          ]
        );
      }
    }

    res.json({
      success: true,
      message: "Advertisement rejected, refund credited, and logged",
      refundId,
      advertisement: ad,
      walletBalance: wallet.balance,
    });
  } catch (err) {
    console.error("Error rejecting ad:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// const adminGetRunningAds = async (req, res) => {
//   try {
//     const runningAds = await reporterAdProof
//       .find({
//         runningAdStatus: "running",
//       })
//       .lean();

//     if (!runningAds || runningAds.length === 0) {
//       return res.status(404).json({ message: "No running ads found" });
//     }

//     for (const ad of runningAds) {
//       if (Array.isArray(ad.proofs)) {
//         for (const proof of ad.proofs) {
//           const { platform, videoLink } = proof;

//           if (platform && videoLink) {
//             try {
//               const liveViews = await getLiveViews(platform, videoLink);
//               proof.liveViews = liveViews ?? "N/A";
//             } catch (err) {
//               console.error(`Error getting views for ${platform}:`, err);
//               proof.liveViews = "N/A";
//             }
//           }
//         }
//       }
//     }

//     res.status(200).json({
//       message: "Running ads fetched successfully",
//       count: runningAds.length,
//       data: runningAds,
//     });
//   } catch (error) {
//     console.error("Error fetching running ads:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

const adminGetRunningAds = async (req, res) => {
  try {
    const runningAds = await reporterAdProof
      .find({ runningAdStatus: "running" })
      .lean(); // keep all proofs and ad details

    if (!runningAds || runningAds.length === 0) {
      return res.status(404).json({ message: "No running ads found" });
    }

    res.status(200).json({
      message: "Running ads fetched successfully",
      count: runningAds.length,
      data: runningAds, // full ad + proof details, but no liveViews yet
    });
  } catch (error) {
    console.error("Error fetching running ads:", error);
    res.status(500).json({ message: "Server error" });
  }
};



const getAllAdsWithAcceptedReporters = async (req, res) => {
  try {
    // Fetch all ads that are not completed
    const ads = await Adpost.find({ status: { $ne: "completed" } })
      .populate('owner', 'name email organization mobile iinsafId role');

    if (!ads.length) {
      return res.status(404).json({ success: false, message: "No ads found" });
    }

    // Map each ad to include total reporters and accepted reporters
    const data = ads.map(ad => {
      const acceptedReporters = ad.acceptRejectReporterList.filter(r => r.accepted);

      return {
        adId: ad._id,
        requiredReporter: ad.requiredReporter,
        adTitle: ad.mediaDescription,
        totalReporters: ad.acceptRejectReporterList.length,
        acceptedCount: acceptedReporters.length,
        acceptedReporters
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching ads with accepted reporters:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get targeted reporters for a specific advertisement
const getAdvertisementTargetedReporters = async (req, res) => {
  try {
    const { adId } = req.params;
    console.log(`🔍 Getting targeted reporters for advertisement: ${adId}`);

    // Find the advertisement
    const advertisement = await Adpost.findById(adId)
      .populate('owner', 'name email organization mobile iinsafId role');
    if (!advertisement) {
      return res.status(404).json({ success: false, message: "Advertisement not found" });
    }

    console.log(`🔍 Advertisement status: ${advertisement.status}`);
    console.log(`🔍 Advertisement targeting:`, {
      allStates: advertisement.allStates,
      adminSelectState: advertisement.adminSelectState,
      adminSelectCities: advertisement.adminSelectCities,
      reporterId: advertisement.reporterId,
      originalState: advertisement.adState,
      originalCity: advertisement.adCity,
      userType: advertisement.userType
    });
    console.log(`🔍 Advertisement reporterId array:`, advertisement.reporterId);
    console.log(`🔍 Advertisement reporterId length:`, advertisement.reporterId?.length || 0);

    // Get reporter responses from acceptRejectReporterList
    const reporterResponses = advertisement.acceptRejectReporterList || [];
    
    // Get proof submissions from ReporterAdProof model
    const ReporterAdProof = require("../../../../models/reporterAdProof/reporterAdProof");
    const adProof = await ReporterAdProof.findOne({ adId: advertisement._id });
    
    console.log(`📊 Found ${reporterResponses.length} reporter responses in acceptRejectReporterList`);
    console.log(`📊 Reporter responses details:`, reporterResponses.map(r => ({ 
      reporterId: r.reporterId, 
      iinsafId: r.iinsafId, 
      accepted: r.accepted, 
      acceptedAt: r.acceptedAt, 
      rejectedAt: r.rejectedAt,
      rejectNote: r.rejectNote 
    })));
    console.log(`📊 Found ${adProof ? adProof.proofs.length : 0} proof submissions`);

    // Only show users who were actually sent notifications (have records in acceptRejectReporterList)
    // This matches the behavior of Raise Your Voice system
    const User = require("../../../../models/userModel/userModel");
    
    console.log(`📋 Only showing users who were actually sent notifications (have records in acceptRejectReporterList)`);
    
    // Get user IDs from acceptRejectReporterList (these are users who were actually notified)
    const notifiedUserIds = reporterResponses.map(reporter => reporter.reporterId).filter(id => id);
    console.log(`📋 Found ${notifiedUserIds.length} users who were actually notified:`, notifiedUserIds);
    
    // Fetch user details for notified users only
    const targetUsers = await User.find({
      _id: { $in: notifiedUserIds }
    }).select("name email mobile iinsafId state city role");
    
    console.log(`✅ Final target users count (only notified users): ${targetUsers.length}`);
    console.log(`✅ Target users:`, targetUsers.map(u => ({ name: u.name, role: u.role, id: u._id })));
    
    // Create a map of responses by user ID from advertisement data
    const responseMap = new Map();
    reporterResponses.forEach(reporter => {
      if (reporter.reporterId) {
        responseMap.set(reporter.reporterId.toString(), {
          postStatus: reporter.postStatus || "pending", // ✅ Use postStatus field
          accepted: reporter.accepted,
          rejected: reporter.accepted === false, // Keep for backward compatibility
          acceptedAt: reporter.acceptedAt,
          rejectedAt: reporter.rejectedAt,
          submittedAt: reporter.submittedAt,
          completedAt: reporter.completedAt,
          rejectNote: reporter.rejectNote || "",
          iinsafId: reporter.iinsafId,
          userRole: reporter.userRole
        });
      }
    });
    
    console.log(`📊 Response map created with ${responseMap.size} responses:`, Array.from(responseMap.entries()).map(([id, response]) => ({ id, postStatus: response.postStatus, accepted: response.accepted, rejected: response.rejected })));
    
    // Create a map of proofs by user ID
    const proofMap = new Map();
    if (adProof && adProof.proofs) {
      adProof.proofs.forEach(proof => {
        if (proof.reporterId) {
          proofMap.set(proof.reporterId.toString(), {
            submittedAt: proof.submittedAt,
            status: proof.status
          });
        }
      });
    }
    
    // Process all targeted users
    const processedUsers = targetUsers.map(user => {
      const response = responseMap.get(user._id.toString());
      const proof = proofMap.get(user._id.toString());
      
      let status = "pending";
      if (response) {
        // ✅ Use postStatus instead of accepted/rejected flags
        if (response.postStatus === "rejected") {
          status = "rejected";
        } else if (response.postStatus === "accepted") {
          status = "accepted";
        } else if (response.postStatus === "submitted") {
          status = "submitted";
        } else if (response.postStatus === "completed") {
          status = "completed";
        }
      }
      
      console.log(`📊 Processing user ${user.name} (${user._id}):`, {
        hasResponse: !!response,
        postStatus: response?.postStatus,
        responseAccepted: response?.accepted,
        responseRejected: response?.rejected,
        hasProof: !!proof,
        finalStatus: status
      });
      
      return {
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userCity: user.city,
        userState: user.state,
        userType: user.role,
        iinsafId: user.iinsafId,
        status: status,
        acceptedAt: response ? response.acceptedAt : null,
        rejectedAt: response ? response.rejectedAt : null,
        submittedAt: response ? response.submittedAt : null,
        completedAt: response ? response.completedAt : null,
        rejectNote: response ? response.rejectNote : "",
        proofSubmitted: !!proof,
        userRole: response ? response.userRole : null
      };
    });
    
    // Separate reporters and influencers
    const reporters = processedUsers.filter(u => u.userType === "Reporter");
    const influencers = processedUsers.filter(u => u.userType === "Influencer");
    
    // Calculate statistics (only for users who were actually notified)
    const stats = {
      totalTargetedReporters: reporters.length,
      totalTargetedInfluencers: influencers.length,
      totalTargetedUsers: processedUsers.length,
      pending: processedUsers.filter(u => u.status === "pending").length,
      accepted: processedUsers.filter(u => u.status === "accepted").length,
      submitted: processedUsers.filter(u => u.status === "submitted").length,
      rejected: processedUsers.filter(u => u.status === "rejected").length,
      completed: processedUsers.filter(u => u.status === "completed").length
    };
    
    console.log(`📊 Final statistics (notified users only):`, stats);

    const response = {
      success: true,
      data: {
        ...stats,
        reporters: reporters,
        influencers: influencers,
        users: processedUsers,
        targetingInfo: {
          allStates: advertisement.allStates,
          adminSelectState: advertisement.adminSelectState,
          adminSelectCities: advertisement.adminSelectCities,
          adminSelectPincode: advertisement.adminSelectPincode,
          userType: advertisement.userType,
          modifiedAt: advertisement.updatedAt
        }
      }
    };

    console.log(`📊 Advertisement targeted users response:`, response.data);
    res.status(200).json(response);

  } catch (error) {
    console.error("Error getting advertisement targeted reporters:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  adminGetAds,
  approvedAds,
  rejectedAds,
  adminModifyAds,
  adminGetRunningAds,
  getAllAdsWithAcceptedReporters,
  getAdvertisementTargetedReporters
};
