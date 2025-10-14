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

const getYouTubeViewCount = async (videoUrl, apiKey) => {
  try {
    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      throw new Error("Invalid or unrecognized YouTube URL");
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;

    const response = await axios.get(apiUrl);

    const items = response.data.items;
    if (!items.length) {
      throw new Error("Video not found");
    }

    const viewCount = items[0].statistics.viewCount;
    console.log("Fetched youtube View Count:", viewCount);

    return parseInt(viewCount, 10);
  } catch (error) {
    console.error("Error in getYouTubeViewCount:", error.message);
    return null;
  }
};

module.exports = getYouTubeViewCount;
