const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");

const getYouTubeViewCount = require("../../utils/getYouTubeViewCount");
const getFacebookViewCount = require("../../utils/getFacebookViewCount");

const submitComplitedAds = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { platform, videoUrl, adId } = req.body;
    const screenshotPath = req.file?.path;

    // ✅ Validate required fields
    if (!platform || !videoUrl || !adId || !screenshotPath) {
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
    let currentViews = null;
    if (platform.toLowerCase() === "youtube") {
      currentViews = await getYouTubeViewCount(videoUrl, process.env.YOUTUBE_API_KEY);
    } else if (platform.toLowerCase() === "facebook") {
      const rawViews = await getFacebookViewCount(videoUrl);
      currentViews = parseInt(rawViews.toString().replace(/[^\d]/g, ""), 10);
    } else {
      return res.status(400).json({ message: "Unsupported platform" });
    }

    if (!currentViews || isNaN(currentViews)) {
      return res.status(500).json({ message: "Failed to fetch current view count" });
    }

    // ✅ 3. Compare views with base view
    if (currentViews < baseView) {
      return res.status(200).json({
        success: false,
        message: `Current views (${currentViews}) are less than required base view (${baseView}). Task not yet completed.`,
      });
    }

    // ✅ 4. Mark proof as completed and save screenshot path
    const updatedDoc = await reporterAdProof.findOneAndUpdate(
      {
        adId,
        "proofs.reporterId": reporterId,
        "proofs.status": { $in: ["submitted", "rejected"] },
      },
      {
        $set: {
          "proofs.$.status": "completed",
          "proofs.$.completedTaskScreenshot": screenshotPath,
        }
      },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ message: "Proof not found or already completed" });
    }

    res.status(200).json({
      success: true,
      message: "Task marked as completed",
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
