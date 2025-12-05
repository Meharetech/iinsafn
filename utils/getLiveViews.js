const getYouTubeViewCount = require('./getYouTubeViewCount');
const getFacebookViewCount = require('./getFacebookViewCount');

/**
 * Get live view count for any platform
 * @param {string} platform - Platform name ('youtube' or 'facebook')
 * @param {string} videoUrl - Video URL
 * @param {number} profile - Profile index for Social Media Views API (optional, defaults to 0)
 * @returns {Promise<number|null>} - Numeric view count or null on error
 */
const getLiveViews = async (platform, videoUrl, profile = 0) => {
  try {
    if (!platform || !videoUrl) return null;

    switch (platform.toLowerCase()) {
      case 'youtube':
        // YouTube API returns numeric value
        return await getYouTubeViewCount(videoUrl, process.env.YOUTUBE_API_KEY, profile);

      case 'facebook':
        // Facebook API: pass returnNumeric=true to get numeric value
        return await getFacebookViewCount(videoUrl, profile, true);

      default:
        return null;
    }
  } catch (err) {
    console.error(`getLiveViews error [${platform}] [${videoUrl}]:`, err.message);
    return null;
  }
};

module.exports = getLiveViews;
