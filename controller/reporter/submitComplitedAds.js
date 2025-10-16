const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");

const getYouTubeViewCount = require("../../utils/getYouTubeViewCount");
const getFacebookViewCount = require("../../utils/getFacebookViewCount");

const submitComplitedAds = async (req, res) => {
  try {
    console.log("🚀 submitComplitedAds called");
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    
    const reporterId = req.user._id;
    const { platform, videoUrl, adId } = req.body;
    const screenshotPath = req.file?.path;

    console.log("Extracted data:", {
      reporterId,
      platform,
      videoUrl,
      adId,
      screenshotPath
    });

    // ✅ Validate required fields
    if (!platform || !videoUrl || !adId || !screenshotPath) {
      console.error("❌ Missing required fields:", {
        platform: !!platform,
        videoUrl: !!videoUrl,
        adId: !!adId,
        screenshotPath: !!screenshotPath
      });
      return res.status(400).json({ message: "Platform, videoUrl, adId, and screenshot are required" });
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
      screenshotPath
    });
    
    const updatedDoc = await reporterAdProof.findOneAndUpdate(
      {
        adId,
        "proofs.reporterId": reporterId,
        "proofs.status": { $in: ["pending", "rejected"] },
      },
      {
        $set: {
          "proofs.$.completedTaskScreenshot": screenshotPath,
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

    res.status(200).json({
      success: true,
      message: updatedDoc?.proofs?.[0]?.status === "rejected" 
        ? "Completion screenshot resubmitted successfully. Admin will review and approve to mark as completed."
        : "Completion screenshot submitted successfully. Admin will review and approve to mark as completed.",
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
