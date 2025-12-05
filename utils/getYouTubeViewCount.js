const axios = require('axios');

const extractVideoId = (url) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'youtu.be') {
      return parsedUrl.pathname.slice(1);
    }
    if (parsedUrl.hostname.includes('youtube.com')) {
      return parsedUrl.searchParams.get('v');
    }
    return null;
  } catch (err) {
    console.error("Invalid URL format:", url);
    return null;
  }
};

/**
 * Extract view count from YouTube video URL
 * Uses new Social Media Views API as primary method, falls back to YouTube API if available
 * @param {string} videoUrl - YouTube video URL
 * @param {string} apiKey - YouTube API key (optional, for fallback)
 * @param {number} profile - Profile index for Social Media Views API (optional, defaults to 0)
 * @returns {Promise<number|null>} - View count as integer or null on error
 */
const getYouTubeViewCount = async (videoUrl, apiKey = null, profile = 0) => {
  try {
    console.log("🚀 Starting YouTube views extraction...");
    console.log(`📺 URL: ${videoUrl}`);

    // ✅ Method 1: Try new Social Media Views API first
    try {
      const apiBaseUrl = process.env.VIEWS_API_BASE_URL || 
                         (process.env.NODE_ENV === 'production' 
                           ? 'http://localhost:8080' 
                           : 'http://localhost:5000');

      const apiUrl = `${apiBaseUrl}/api/youtube/views`;
      
      console.log("📡 Trying Social Media Views API...");
      const response = await axios.get(apiUrl, {
        params: {
          url: videoUrl,
          profile: profile
        },
        timeout: 60000 // 60 seconds timeout
      });

      if (response.data && response.data.views) {
        const viewsText = response.data.views;
        console.log("✅ Found views from Social Media Views API:", viewsText);
        
        // Extract numeric value from "1.2B views" format
        const numericViews = extractNumericViews(viewsText);
        if (numericViews !== null) {
          return numericViews;
        }
      }
    } catch (apiError) {
      console.warn("⚠️ Social Media Views API failed, trying fallback method...");
      console.warn("⚠️ Error:", apiError.message);
    }

    // ✅ Method 2: Fallback to YouTube API (if apiKey is provided)
    if (apiKey) {
      console.log("📡 Trying YouTube API as fallback...");
      const videoId = extractVideoId(videoUrl);

      if (!videoId) {
        throw new Error("Invalid or unrecognized YouTube URL");
      }

      const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;
      const response = await axios.get(youtubeApiUrl);

      const items = response.data.items;
      if (!items.length) {
        throw new Error("Video not found");
      }

      const viewCount = parseInt(items[0].statistics.viewCount, 10);
      console.log("✅ Fetched YouTube view count from YouTube API:", viewCount);
      return viewCount;
    } else {
      console.warn("⚠️ No YouTube API key provided, cannot use fallback method");
      return null;
    }

  } catch (error) {
    console.error("❌ Error in getYouTubeViewCount:", error.message);
    return null;
  }
};

/**
 * Extract numeric view count from formatted string like "1.2B views", "495 views", "1.5K views"
 * @param {string} viewsText - Formatted views string
 * @returns {number|null} - Numeric view count or null if parsing fails
 */
const extractNumericViews = (viewsText) => {
  try {
    if (!viewsText) return null;

    // Remove "views" text and trim
    const cleaned = viewsText.toLowerCase().replace(/views/g, '').trim();
    
    // Handle formats like "1.2B", "495", "1.5K", "2.3M"
    const match = cleaned.match(/(\d+\.?\d*)\s*([kmb])?/i);
    
    if (!match) {
      // Try to extract just numbers
      const numbersOnly = cleaned.replace(/[^\d.]/g, '');
      if (numbersOnly) {
        return parseInt(numbersOnly, 10);
      }
      return null;
    }

    const number = parseFloat(match[1]);
    const multiplier = match[2] ? match[2].toUpperCase() : '';

    let multiplierValue = 1;
    switch (multiplier) {
      case 'K':
        multiplierValue = 1000;
        break;
      case 'M':
        multiplierValue = 1000000;
        break;
      case 'B':
        multiplierValue = 1000000000;
        break;
    }

    return Math.floor(number * multiplierValue);
  } catch (error) {
    console.error("Error parsing views text:", viewsText, error.message);
    return null;
  }
};

module.exports = getYouTubeViewCount;
