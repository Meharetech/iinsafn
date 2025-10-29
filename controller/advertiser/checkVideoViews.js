const Adpost = require("../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../models/reporterAdProof/reporterAdProof");
const getLiveViews = require("../../utils/getLiveViews");

const checkVideoViews = async (req, res) => {
  const owner = req.user._id;
  const { adId } = req.params;

  try {
    console.log(`📊 Checking video views for ad: ${adId}`);

    // Step 1: Verify the advertisement belongs to this advertiser and is completed
    const advertisement = await Adpost.findOne({ 
      _id: adId, 
      owner: owner,
      status: "completed"
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found, not completed, or you don't have permission to view it."
      });
    }

    console.log(`✅ Advertisement found: ${advertisement._id}`);

    // Step 2: Get all proofs for this advertisement
    const proofDoc = await reporterAdProof.findOne({
      adId: adId
    }).populate('proofs.reporterId', 'name email iinsafId');

    console.log(`📋 Proof document found:`, proofDoc ? 'Yes' : 'No');
    console.log(`📋 Number of proofs:`, proofDoc?.proofs?.length || 0);

    // Get only completed and approved proofs
    const completedProofs = proofDoc && proofDoc.proofs 
      ? proofDoc.proofs.filter(proof => 
          proof.status === "completed" && proof.adminApprovedAt
        )
      : [];

    console.log(`✅ Completed & approved proofs: ${completedProofs.length}`);

    if (!completedProofs || completedProofs.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No completed and approved proofs found for this advertisement.",
        data: {
          advertisement: {
            adId: advertisement._id,
            adType: advertisement.adType,
            mediaType: advertisement.mediaType,
            mediaDescription: advertisement.mediaDescription,
            requiredViews: advertisement.requiredViews,
            createdAt: advertisement.createdAt
          },
          performanceMetrics: {
            requiredViews: advertisement.requiredViews || 0,
            totalViewsAchieved: 0,
            viewsDifference: -(advertisement.requiredViews || 0),
            achievementPercentage: 0,
            totalProofs: 0,
            processedProofs: 0,
            successRate: 0
          },
          viewResults: [],
          summary: {
            totalVideosChecked: 0,
            successfulChecks: 0,
            failedChecks: 0,
            noLinks: 0
          }
        }
      });
    }

    const proofs = { proofs: completedProofs };

    // Step 3: Check views for each video link
    const viewResults = [];
    let totalViews = 0;
    let processedCount = 0;

    for (const proof of proofs.proofs) {
      if (proof.videoLink && proof.platform) {
        try {
          console.log(`🔍 Checking views for ${proof.platform}: ${proof.videoLink}`);
          
          const views = await getLiveViews(proof.platform, proof.videoLink);
          
          const viewData = {
            reporterId: proof.reporterId?._id || proof.reporterId,
            iinsafId: proof.reporterId?.iinsafId || proof.iinsafId || 'N/A',
            reporterName: proof.reporterId?.name || 'N/A',
            platform: proof.platform,
            videoLink: proof.videoLink,
            channelName: proof.channelName,
            views: views || 0,
            submittedAt: proof.submittedAt,
            completionSubmittedAt: proof.completionSubmittedAt,
            adminApprovedAt: proof.adminApprovedAt,
            status: views ? "success" : "failed"
          };

          viewResults.push(viewData);
          
          if (views && typeof views === 'number') {
            totalViews += views;
            processedCount++;
          }

          console.log(`✅ ${proof.platform} views: ${views || 'N/A'}`);
        } catch (error) {
          console.error(`❌ Error checking views for ${proof.platform}:`, error.message);
          
          viewResults.push({
            reporterId: proof.reporterId?._id || proof.reporterId,
            iinsafId: proof.reporterId?.iinsafId || proof.iinsafId || 'N/A',
            reporterName: proof.reporterId?.name || 'N/A',
            platform: proof.platform,
            videoLink: proof.videoLink,
            channelName: proof.channelName,
            views: 0,
            submittedAt: proof.submittedAt,
            completionSubmittedAt: proof.completionSubmittedAt,
            adminApprovedAt: proof.adminApprovedAt,
            status: "error",
            error: error.message
          });
        }
      } else {
        // No video link or platform
        viewResults.push({
          reporterId: proof.reporterId?._id || proof.reporterId,
          iinsafId: proof.reporterId?.iinsafId || proof.iinsafId || 'N/A',
          reporterName: proof.reporterId?.name || 'N/A',
          platform: proof.platform || "N/A",
          videoLink: proof.videoLink || "N/A",
          channelName: proof.channelName || "N/A",
          views: 0,
          submittedAt: proof.submittedAt,
          completionSubmittedAt: proof.completionSubmittedAt,
          adminApprovedAt: proof.adminApprovedAt,
          status: "no_link"
        });
      }
    }

    // Step 4: Calculate performance metrics
    const requiredViews = advertisement.requiredViews || 0;
    const achievementPercentage = requiredViews > 0 ? (totalViews / requiredViews) * 100 : 0;
    const viewsDifference = totalViews - requiredViews;

    const performanceMetrics = {
      requiredViews: requiredViews,
      totalViewsAchieved: totalViews,
      viewsDifference: viewsDifference,
      achievementPercentage: Math.round(achievementPercentage * 100) / 100,
      totalProofs: proofs.proofs.length,
      processedProofs: processedCount,
      successRate: proofs.proofs.length > 0 ? (processedCount / proofs.proofs.length) * 100 : 0
    };

    console.log(`📊 Video Views Summary for Ad ${adId}:`);
    console.log(`   Required Views: ${requiredViews}`);
    console.log(`   Total Views Achieved: ${totalViews}`);
    console.log(`   Achievement: ${achievementPercentage.toFixed(2)}%`);
    console.log(`   Processed: ${processedCount}/${proofs.proofs.length} proofs`);

    return res.status(200).json({
      success: true,
      message: "Video views checked successfully",
      data: {
        advertisement: {
          adId: advertisement._id,
          adType: advertisement.adType,
          mediaType: advertisement.mediaType,
          mediaDescription: advertisement.mediaDescription,
          requiredViews: requiredViews,
          createdAt: advertisement.createdAt,
          completedAt: advertisement.completedAt,
          status: advertisement.status
        },
        performanceMetrics: performanceMetrics,
        viewResults: viewResults,
        completionDetails: advertisement.completionDetails || null,
        summary: {
          totalVideosChecked: viewResults.length,
          successfulChecks: viewResults.filter(r => r.status === "success").length,
          failedChecks: viewResults.filter(r => r.status === "failed" || r.status === "error").length,
          noLinks: viewResults.filter(r => r.status === "no_link").length
        }
      }
    });

  } catch (error) {
    console.error("Error checking video views:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while checking video views."
    });
  }
};

module.exports = checkVideoViews;
