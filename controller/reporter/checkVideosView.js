const getYouTubeViewCount = require('../../utils/getYouTubeViewCount');
const getFacebookViewCount = require('../../utils/getFacebookViewCount');

const checkVideosView = async (req, res) => {
  try {
    const { platform, videoUrl } = req.body;

    if (!platform || !videoUrl) {
      return res.status(400).json({ message: "Platform and video URL are required" });
    }

    let views = null;

    switch (platform.toLowerCase()) {
      case 'youtube':
        views = await getYouTubeViewCount(videoUrl, process.env.YOUTUBE_API_KEY);
        break;

      case 'facebook':
        views = await getFacebookViewCount(videoUrl);
        break;

      default:
        return res.status(400).json({ message: "Unsupported platform. Supported: youtube, facebook" });
    }

    if (views === null) {
      return res.status(500).json({ message: "Failed to fetch view count" });
    }

    res.status(200).json({
      success: true,
      platform,
      videoUrl,
      views
    });
  } catch (err) {
    console.error("checkVideosView error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error while checking view count"
    });
  }
};

module.exports = checkVideosView;
