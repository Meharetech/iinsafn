const axios = require("axios");

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

/**
 * Extract view count from Facebook video URL using Social Media Views API
 * @param {string} videoUrl - Facebook video URL
 * @param {number} profile - Profile index (optional, defaults to 0)
 * @param {boolean} returnNumeric - If true, returns numeric value; if false, returns formatted string (default: false)
 * @returns {Promise<number|string|null>} - View count as number/string or null on error
 */
const getFacebookViewCount = async (videoUrl, profile = 0, returnNumeric = false) => {
  try {
    console.log("🚀 Starting Facebook views extraction with Social Media Views API...");
    console.log(`📱 URL: ${videoUrl}`);
    console.log(`👤 Profile: ${profile}\n`);

    // Determine API base URL (development or production)
    const apiBaseUrl = process.env.VIEWS_API_BASE_URL || 
                       (process.env.NODE_ENV === 'production' 
                         ? 'http://localhost:8080' 
                         : 'http://localhost:5000');

    // Build API endpoint URL
    const apiUrl = `${apiBaseUrl}/api/facebook/views`;
    
    // Make API request
    const response = await axios.get(apiUrl, {
      params: {
        url: videoUrl,
        profile: profile
      },
      timeout: 60000 // 60 seconds timeout (API takes 10-30 seconds)
    });

    // Check if response contains views
    if (response.data && response.data.views) {
      const viewsText = response.data.views;
      console.log("✅ Found views:", viewsText);
      
      // Return numeric value if requested, otherwise return formatted string
      if (returnNumeric) {
        const numericViews = extractNumericViews(viewsText);
        return numericViews;
      }
      return viewsText;
    } else if (response.data && response.data.error) {
      console.error("❌ API Error:", response.data.error);
      return null;
    } else {
      console.error("❌ Invalid response format:", response.data);
      return null;
    }

  } catch (error) {
    console.error("💥 ERROR fetching Facebook views:", error.message);
    if (error.response) {
      console.error("❌ Response status:", error.response.status);
      console.error("❌ Response data:", error.response.data);
    }
    return null;
  }
};

module.exports = getFacebookViewCount;

