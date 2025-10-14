const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");
const Adpost = require("../../models/advertismentPost/advertisementPost");
const getYouTubeViewCount = require("../../utils/getYouTubeViewCount");
const getFacebookViewCount = require("../../utils/getFacebookViewCount");

// const getRunningAds = async (req, res) => {
//   try {
//     const advertiserId = req.user._id;
//     const youtubeApiKey = process.env.YOUTUBE_API_KEY;
//     const viewCountCache = {};

//     const runningProofs = await reporterAdProof.find({ runningAdStatus: "running" });

//     if (!runningProofs.length) {
//       return res.status(404).json({ success: false, message: "No running ad proofs found" });
//     }

//     const adIds = runningProofs.map((proof) => proof.adId);
//     const ads = await Adpost.find({
//       _id: { $in: adIds },
//       owner: advertiserId,
//     });

//     if (!ads.length) {
//       return res.status(404).json({ success: false, message: "No ads found for current advertiser" });
//     }

//     const data = await Promise.all(
//       ads.map(async (ad) => {
//         const proofs = runningProofs.filter((p) => p.adId.toString() === ad._id.toString());
//         if (!proofs.length) return null;

//         const allProofs = proofs.flatMap((p) => p?.proofs ?? []);

//         const simplifiedProofs = (
//           await Promise.all(
//             allProofs.map(async (proof, index) => {
//               const { videoLink, platform, reporterId } = proof;

//               if (!videoLink || !platform) {
//                 console.warn("⚠️ Skipping proof with missing videoLink or platform");
//                 return null;
//               }

//               const cacheKey = `${platform.toLowerCase()}_${videoLink}`;
//               let viewCount = viewCountCache[cacheKey] ?? null;

//               if (viewCount === null) {
//                 try {
//                   if (platform.toLowerCase() === "youtube") {
//                     // console.log("📡 Calling YouTube API...");
//                     viewCount = await getYouTubeViewCount(videoLink, youtubeApiKey);
//                   } else if (platform.toLowerCase() === "facebook") {
//                     // console.log("📡 Calling Facebook API...");
//                     viewCount = await getFacebookViewCount(videoLink);
//                   } else {
//                     console.warn(`⚠️ Unknown platform: ${platform}`);
//                   }

//                   // console.log("this console after knwoing fb views",viewCount)

//                   if (viewCount !== null) {
//                     viewCountCache[cacheKey] = viewCount;
//                   }
//                 } catch (err) {
//                   console.error(`❌ Failed to fetch view count: ${err.message}`);
//                 }
//               }

//               return {
//                 reporterId,
//                 screenshot: proof.screenshot,
//                 channelName: proof.channelName,
//                 platform,
//                 videoLink,
//                 duration: proof.duration,
//                 submittedAt: proof.submittedAt,
//                 currentViewCount: viewCount,
//               };
//             })
//           )
//         ).filter(Boolean); // remove nulls

//         return {
//           adId: ad._id,
//           adTitle: ad.mediaDescription,
//           proofs: simplifiedProofs,
//         };
//       })
//     );

//     return res.status(200).json({ success: true, data: data.filter(Boolean) });
//   } catch (error) {
//     console.error("❌ Error in getRunningAds:", error.message);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

// module.exports = getRunningAds;







const getRunningAds = async (req, res) => {
  try {
    const advertiserId = req.user._id;

    // 1. Find all running proofs
    const runningProofs = await reporterAdProof.find({ runningAdStatus: "running" });

    if (!runningProofs.length) {
      return res.status(404).json({ success: false, message: "No running ad proofs found" });
    }

    // 2. Get ads of this advertiser
    const adIds = runningProofs.map((proof) => proof.adId);
    const ads = await Adpost.find({
      _id: { $in: adIds },
      owner: advertiserId,
    });

    if (!ads.length) {
      return res.status(404).json({ success: false, message: "No ads found for current advertiser" });
    }

    // 3. Build response data
    const data = ads.map((ad) => {
      const proofs = runningProofs.filter((p) => p.adId.toString() === ad._id.toString());
      if (!proofs.length) return null;

      const allProofs = proofs.flatMap((p) => p?.proofs ?? []);

      const simplifiedProofs = allProofs.map((proof) => ({
        reporterId: proof.reporterId,
        screenshot: proof.screenshot,
        channelName: proof.channelName,
        platform: proof.platform,
        videoLink: proof.videoLink,
        duration: proof.duration,
        submittedAt: proof.submittedAt,
        // 🔥 No more view fetching
      }));

      return {
        adId: ad._id,
        adTitle: ad.mediaDescription,
        proofs: simplifiedProofs,
      };
    }).filter(Boolean);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Error in getRunningAds:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = getRunningAds;
