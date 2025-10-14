const getYouTubeViewCount = require('./getYouTubeViewCount');
const getFacebookViewCount = require('./getFacebookViewCount');

const getLiveViews = async (platform, videoUrl) => {
  try {
    if (!platform || !videoUrl) return null;

    switch (platform.toLowerCase()) {
      case 'youtube':
        return await getYouTubeViewCount(videoUrl, process.env.YOUTUBE_API_KEY);

      case 'facebook':
        return await getFacebookViewCount(videoUrl);

      default:
        return null;
    }
  } catch (err) {
    console.error(`getLiveViews error [${platform}] [${videoUrl}]:`, err.message);
    return null;
  }
};

module.exports = getLiveViews;
