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
 * Poll task status until completion or failure
 * @param {string} apiBaseUrl - API base URL
 * @param {string} taskId - Task ID to poll
 * @param {number} maxWaitTime - Maximum time to wait in milliseconds (default: 300000 = 5 minutes)
 * @param {number} pollInterval - Polling interval in milliseconds (default: 2000 = 2 seconds)
 * @returns {Promise<object|null>} - Task result or null on failure
 */
const pollTaskStatus = async (apiBaseUrl, taskId, maxWaitTime = 300000, pollInterval = 2000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const statusUrl = `${apiBaseUrl}/api/task/${taskId}`;
      const statusResponse = await axios.get(statusUrl, {
        timeout: 10000
      });

      const statusData = statusResponse.data;
      
      if (statusData.status === 'completed') {
        console.log("✅ Task completed successfully");
        return statusData.result;
      } else if (statusData.status === 'failed') {
        console.error("❌ Task failed:", statusData.result?.error || "Unknown error");
        return null;
      } else if (statusData.status === 'processing') {
        console.log(`⏳ Task processing... (queue position: ${statusData.queue_position || 'N/A'})`);
      } else if (statusData.status === 'pending') {
        console.log(`⏳ Task pending in queue... (queue position: ${statusData.queue_position || 'N/A'})`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (pollError) {
      console.warn("⚠️ Error polling task status:", pollError.message);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  console.error("❌ Task polling timeout after", maxWaitTime / 1000, "seconds");
  return null;
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
    
    // Method 1: Try with wait=true to get result directly (blocking)
    try {
      console.log("📡 Trying with wait=true (blocking mode)...");
      const response = await axios.get(apiUrl, {
        params: {
          url: videoUrl,
          profile: profile,
          wait: 'true'
        },
        timeout: 300000 // 5 minutes timeout for blocking request
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
      }
    } catch (waitError) {
      // If wait=true fails (timeout or error), try non-blocking with polling
      if (waitError.code === 'ECONNABORTED' || waitError.response?.status === 504) {
        console.warn("⚠️ Blocking request timed out, trying non-blocking with polling...");
      } else {
        console.warn("⚠️ Blocking request failed, trying non-blocking with polling...");
        console.warn("⚠️ Error:", waitError.message);
      }
    }

    // Method 2: Non-blocking request with polling
    console.log("📡 Trying non-blocking mode with polling...");
    const response = await axios.get(apiUrl, {
      params: {
        url: videoUrl,
        profile: profile
      },
      timeout: 10000 // 10 seconds timeout for initial request
    });

    // Check if response is a task queued response
    if (response.data && response.data.task_id) {
      const taskId = response.data.task_id;
      const queuePosition = response.data.queue_position;
      console.log(`📋 Task queued successfully. Task ID: ${taskId}`);
      console.log(`📍 Queue position: ${queuePosition}`);
      console.log("⏳ Polling for task completion...");

      // Poll for task completion
      const result = await pollTaskStatus(apiBaseUrl, taskId);

      if (result && result.views) {
        const viewsText = result.views;
        console.log("✅ Found views:", viewsText);
        
        // Return numeric value if requested, otherwise return formatted string
        if (returnNumeric) {
          const numericViews = extractNumericViews(viewsText);
          return numericViews;
        }
        return viewsText;
      } else if (result && result.error) {
        console.error("❌ Task failed with error:", result.error);
        return null;
      } else {
        console.error("❌ Task completed but no views found in result");
        return null;
      }
    }
    // Check if response contains views directly (shouldn't happen in queue mode, but handle it)
    else if (response.data && response.data.views) {
      const viewsText = response.data.views;
      console.log("✅ Found views:", viewsText);
      
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

