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

    console.log(`📊 Fetching running ads for advertiser: ${advertiserId}`);

    // 1. Find all running proofs
    const runningProofs = await reporterAdProof.find({ runningAdStatus: "running" });

    console.log(`📋 Found ${runningProofs.length} running proof documents`);

    if (!runningProofs.length) {
      return res.status(404).json({ success: false, message: "No running ad proofs found" });
    }

    // 2. Get ads of this advertiser
    const adIds = runningProofs.map((proof) => proof.adId);
    const ads = await Adpost.find({
      _id: { $in: adIds },
      owner: advertiserId,
    });

    console.log(`📊 Found ${ads.length} running ads for advertiser`);

    if (!ads.length) {
      return res.status(404).json({ success: false, message: "No ads found for current advertiser" });
    }

    // 3. Build response data with complete ad details
    const data = ads.map((ad) => {
      const proofs = runningProofs.filter((p) => p.adId.toString() === ad._id.toString());
      if (!proofs.length) return null;

      const allProofs = proofs.flatMap((p) => p?.proofs ?? []);

      // ✅ FILTER: Only show proofs where initial proof is APPROVED (status: "approved" or "submitted" or "completed")
      // Don't show "pending" or "rejected" proofs to advertisers
      const approvedProofs = allProofs.filter((proof) =>
        proof.status === "approved" ||
        proof.status === "submitted" ||
        proof.status === "completed"
      );

      console.log(`📋 Ad ${ad._id}: Total proofs: ${allProofs.length}, Approved proofs: ${approvedProofs.length}`);
      console.log(`📋 Proof statuses:`, allProofs.map(p => ({ iinsafId: p.iinsafId, status: p.status })));

      const simplifiedProofs = approvedProofs.map((proof) => ({
        reporterId: proof.reporterId,
        screenshot: proof.screenshot,
        channelName: proof.channelName,
        platform: proof.platform,
        videoLink: proof.videoLink,
        duration: proof.duration,
        submittedAt: proof.submittedAt,
        completionSubmittedAt: proof.completionSubmittedAt,
        iinsafId: proof.iinsafId,
        status: proof.status
      }));

      // ✅ Only return ad if it has at least one approved proof
      // This prevents advertisers from seeing ads with only pending/rejected proofs
      if (simplifiedProofs.length === 0) {
        console.log(`⚠️ Skipping ad ${ad._id} - no approved proofs`);
        return null;
      }

      return {
        adId: ad._id,
        adTitle: ad.mediaDescription,
        // Include all advertisement details
        adType: ad.adType,
        mediaType: ad.mediaType,
        mediaDescription: ad.mediaDescription,
        userType: ad.userType,
        requiredViews: ad.requiredViews,
        adLength: ad.adLength,
        totalCost: ad.totalCost,
        subtotal: ad.subtotal,
        gst: ad.gst,
        finalReporterPrice: ad.finalReporterPrice,
        startDate: ad.startDate,
        endDate: ad.endDate,
        pfState: ad.pfState,
        pfCities: ad.pfCities,
        createdAt: ad.createdAt,
        approvedAt: ad.approvedAt,
        imageUrl: ad.imageUrl,
        videoUrl: ad.videoUrl,
        requiredReporter: ad.requiredReporter,
        allStates: ad.allStates,
        adminSelectState: ad.adminSelectState,
        adminSelectCities: ad.adminSelectCities,
        adminSelectPincode: ad.adminSelectPincode,
        status: ad.status,
        updatedAt: ad.updatedAt,
        proofs: simplifiedProofs,
        totalProofs: simplifiedProofs.length
      };
    }).filter(Boolean); // Remove null entries (ads with no approved proofs)

    console.log(`✅ Returning ${data.length} running advertisements with approved proofs only`);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Error in getRunningAds:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = getRunningAds;
