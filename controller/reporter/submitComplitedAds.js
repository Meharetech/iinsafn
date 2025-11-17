const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const fs = require("fs");

const getYouTubeViewCount = require("../../utils/getYouTubeViewCount");
const getFacebookViewCount = require("../../utils/getFacebookViewCount");

const submitComplitedAds = async (req, res) => {
  try {
    console.log("🚀 submitComplitedAds called");
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    
    const reporterId = req.user._id;
    const { platform, videoUrl, adId } = req.body;
    const screenshotFile = req.file;

    console.log("Extracted data:", {
      reporterId,
      platform,
      videoUrl,
      adId,
      hasScreenshotFile: !!screenshotFile
    });

    // ✅ Validate required fields
    if (!platform || !videoUrl || !adId || !screenshotFile) {
      console.error("❌ Missing required fields:", {
        platform: !!platform,
        videoUrl: !!videoUrl,
        adId: !!adId,
        hasScreenshotFile: !!screenshotFile
      });
      return res.status(400).json({ message: "Platform, videoUrl, adId, and screenshot are required" });
    }

    // ✅ Upload screenshot to Cloudinary
    let screenshotUrl = null;
    try {
      console.log("Uploading completion screenshot to Cloudinary...");
      const cloudinaryResult = await uploadToCloudinary(screenshotFile.path, "ads/completion-screenshots");
      screenshotUrl = cloudinaryResult.secure_url;
      console.log("Completion screenshot uploaded successfully:", screenshotUrl);
      
      // ✅ Delete local file after successful upload
      if (fs.existsSync(screenshotFile.path)) {
        fs.unlinkSync(screenshotFile.path);
        console.log("Local file deleted:", screenshotFile.path);
      }
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(500).json({ message: "Failed to upload completion screenshot" });
    }

    // ✅ 1. Get Ad post details
    const adPost = await Adpost.findById(adId);
    if (!adPost) {
      return res.status(404).json({ message: "Ad not found" });
    }

    const baseView = adPost.baseView;
    if (!baseView || isNaN(baseView)) {
      return res.status(400).json({ message: "Invalid base view in Adpost" });
    }

    // ✅ 2. Fetch current views
    console.log("📊 Fetching current views for platform:", platform);
    let currentViews = null;
    try {
      if (platform.toLowerCase() === "youtube") {
        console.log("📺 Fetching YouTube views for:", videoUrl);
        currentViews = await getYouTubeViewCount(videoUrl, process.env.YOUTUBE_API_KEY);
        console.log("📺 YouTube views result:", currentViews);
      } else if (platform.toLowerCase() === "facebook") {
        console.log("📘 Fetching Facebook views for:", videoUrl);
        const rawViews = await getFacebookViewCount(videoUrl);
        currentViews = parseInt(rawViews.toString().replace(/[^\d]/g, ""), 10);
        console.log("📘 Facebook views result:", currentViews);
      } else {
        console.error("❌ Unsupported platform:", platform);
        return res.status(400).json({ message: "Unsupported platform" });
      }
    } catch (viewError) {
      console.error("❌ Error fetching views:", viewError);
      return res.status(500).json({ message: "Failed to fetch current view count: " + viewError.message });
    }

    if (!currentViews || isNaN(currentViews)) {
      console.error("❌ Invalid view count:", currentViews);
      return res.status(500).json({ message: "Failed to fetch current view count" });
    }

    // ✅ 3. Compare views with base view
    if (currentViews < baseView) {
      return res.status(200).json({
        success: false,
        message: `Current views (${currentViews}) are less than required base view (${baseView}). Task not yet completed.`,
      });
    }

    // ✅ 4. Update proof with completion screenshot but keep status as "submitted" for admin review
    console.log("💾 Updating proof in database:", {
      adId,
      reporterId,
      screenshotUrl
    });
    
    // ✅ Check if initial proof was approved - only allow final proof submission if initial proof is approved
    const existingProof = await reporterAdProof.findOne({
      adId,
      "proofs.reporterId": reporterId
    });
    
    if (!existingProof) {
      return res.status(404).json({ message: "Proof not found. Please submit initial proof first." });
    }
    
    const reporterProof = existingProof.proofs.find(
      (p) => p.reporterId.toString() === reporterId.toString()
    );
    
    if (!reporterProof) {
      return res.status(404).json({ message: "Proof not found. Please submit initial proof first." });
    }
    
    // ✅ CRITICAL: Only allow final proof submission if initial proof is APPROVED
    // If status is "rejected", it means initial proof was rejected - reporter must resubmit initial proof first
    if (reporterProof.status !== "approved") {
      return res.status(400).json({ 
        message: "Initial proof must be approved before submitting final proof. Please resubmit your initial proof first." 
      });
    }
    
    const updatedDoc = await reporterAdProof.findOneAndUpdate(
      {
        adId,
        "proofs.reporterId": reporterId,
        "proofs.status": "approved", // ✅ Only allow if initial proof is approved
      },
      {
        $set: {
          "proofs.$.completedTaskScreenshot": screenshotUrl, // ✅ Use Cloudinary URL
          "proofs.$.completionSubmittedAt": new Date(),
          "proofs.$.status": "submitted", // ✅ Set status to "submitted" for admin review
        }
      },
      { new: true }
    );

    console.log("💾 Database update result:", updatedDoc ? "Success" : "Failed");
    console.log("📊 Updated proof data:", updatedDoc?.proofs?.[0]);

    if (!updatedDoc) {
      console.error("❌ Proof not found or already completed");
      return res.status(404).json({ message: "Proof not found or already completed" });
    }

    // ✅ Update reporter's status in the ad to show proof is submitted
    await Adpost.updateOne(
      { _id: adId, "acceptRejectReporterList.reporterId": reporterId },
      {
        $set: {
          "acceptRejectReporterList.$.postStatus": "proof_submitted",
          "acceptRejectReporterList.$.submittedAt": new Date(),
        },
        $unset: {
          "acceptRejectReporterList.$.rejectedAt": 1,
          "acceptRejectReporterList.$.rejectNote": 1,
          "acceptRejectReporterList.$.adminRejectedBy": 1,
          "acceptRejectReporterList.$.adminRejectedByName": 1,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Completion screenshot submitted successfully. Admin will review and approve to mark as completed.",
      data: updatedDoc,
    });

  } catch (error) {
    console.error("submitComplitedAds Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while marking task as completed",
    });
  }
};

module.exports = submitComplitedAds;
