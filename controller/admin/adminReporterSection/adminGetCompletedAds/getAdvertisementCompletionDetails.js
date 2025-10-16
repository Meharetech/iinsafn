const Adpost = require("../../../../models/advertismentPost/advertisementPost");
const reporterAdProof = require("../../../../models/reporterAdProof/reporterAdProof");
const User = require("../../../../models/userModel/userModel");
const Wallet = require("../../../../models/Wallet/walletSchema");

const getAdvertisementCompletionDetails = async (req, res) => {
  try {
    const { adId } = req.params;
    
    if (!adId) {
      return res.status(400).json({
        success: false,
        message: "Advertisement ID is required"
      });
    }

    console.log("🔍 Getting completion details for ad:", adId);

    // Find the advertisement
    const advertisement = await Adpost.findById(adId).populate('owner', 'name email organization mobile iinsafId role');
    
    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found"
      });
    }

    console.log("📊 Advertisement found:", advertisement._id);

    // Find all proofs for this advertisement
    const allProofs = await reporterAdProof.find({ adId: adId }).populate('proofs.reporterId', 'name email iinsafId role');
    
    console.log("📋 Total proofs found:", allProofs.length);
    console.log("📋 Total assigned reporters:", advertisement.acceptRejectReporterList?.length || 0);

    // Analyze completion status
    const completionAnalysis = {
      adId: advertisement._id,
      advertisement: advertisement,
      totalReporters: advertisement.requiredReporter || 0,
      completedReporters: 0,
      pendingReporters: 0,
      rejectedReporters: 0,
      incompleteReporters: 0,
      totalRefundAmount: 0,
      reporterDetails: [],
      refundDetails: []
    };

    // Process only the required number of reporters (take first N reporters from the list)
    const requiredReporters = (advertisement.acceptRejectReporterList || []).slice(0, advertisement.requiredReporter || 0);
    
    console.log("📋 Required reporters:", advertisement.requiredReporter);
    console.log("📋 Total assigned reporters:", advertisement.acceptRejectReporterList?.length || 0);
    console.log("📋 Processing first", requiredReporters.length, "reporters");

    for (const assignedReporter of requiredReporters) {
      // Find if this reporter has submitted any proof
      let reporterProof = null;
      for (const proofDoc of allProofs) {
        reporterProof = proofDoc.proofs.find(p => 
          p.reporterId && p.reporterId._id.toString() === assignedReporter.reporterId.toString()
        );
        if (reporterProof) break;
      }
        
        const reporterDetail = {
          reporterId: assignedReporter.reporterId,
          reporterName: assignedReporter.reporterId?.name || 'Unknown',
          reporterEmail: assignedReporter.reporterId?.email || 'Unknown',
          iinsafId: assignedReporter.iinsafId,
          channelName: reporterProof?.channelName || 'Not provided',
          platform: reporterProof?.platform || 'Not specified',
          status: reporterProof?.status || 'not_submitted',
          submittedAt: reporterProof?.submittedAt,
          adminApprovedAt: reporterProof?.adminApprovedAt,
          adminRejectedAt: reporterProof?.adminRejectedAt,
          adminRejectNote: reporterProof?.adminRejectNote,
          adminRejectedBy: reporterProof?.adminRejectedBy,
          adminRejectedByName: reporterProof?.adminRejectedByName,
          completionSubmittedAt: reporterProof?.completionSubmittedAt,
          completedTaskScreenshot: reporterProof?.completedTaskScreenshot,
          shouldRefund: false,
          refundAmount: 0,
          refundReason: ''
        };

        // Check completion status - ONLY completed and admin approved work is considered complete
        if (reporterProof && reporterProof.status === "completed" && reporterProof.adminApprovedAt) {
          completionAnalysis.completedReporters++;
          reporterDetail.refundReason = "Work completed successfully - no refund needed";
        } else {
          // ALL other statuses are considered incomplete and need refund
          completionAnalysis.incompleteReporters++;
          reporterDetail.shouldRefund = true;
          reporterDetail.refundAmount = advertisement.finalReporterPrice || 0;
          completionAnalysis.totalRefundAmount += reporterDetail.refundAmount;
          
          // Determine specific reason for refund
          if (!reporterProof) {
            reporterDetail.refundReason = "No proof submitted - incomplete task";
          } else if (reporterProof.status === "rejected") {
            reporterDetail.refundReason = "Work rejected by admin - incomplete task";
          } else if (reporterProof.status === "submitted" && !reporterProof.adminApprovedAt) {
            reporterDetail.refundReason = "Proof submitted but not approved by admin - incomplete task";
          } else if (reporterProof.status === "accepted") {
            reporterDetail.refundReason = "Initial proof accepted but completion work not submitted - incomplete task";
          } else if (reporterProof.status === "pending") {
            reporterDetail.refundReason = "Initial proof submitted but completion work not submitted - incomplete task";
          } else {
            reporterDetail.refundReason = "No proof submitted - incomplete task";
          }
        }

        completionAnalysis.reporterDetails.push(reporterDetail);

        // Add to refund details if applicable
        if (reporterDetail.shouldRefund) {
          completionAnalysis.refundDetails.push({
            reporterId: assignedReporter.reporterId,
            reporterName: reporterDetail.reporterName,
            amount: reporterDetail.refundAmount,
            reason: reporterDetail.refundReason
          });
        }
    }

    // Calculate completion percentage - only completed and admin approved work counts
    const completionPercentage = completionAnalysis.totalReporters > 0 
      ? (completionAnalysis.completedReporters / completionAnalysis.totalReporters) * 100 
      : 0;
    
    console.log("📊 Completion Analysis:", {
      totalReporters: completionAnalysis.totalReporters,
      completedReporters: completionAnalysis.completedReporters,
      incompleteReporters: completionAnalysis.incompleteReporters,
      totalRefundAmount: completionAnalysis.totalRefundAmount,
      completionPercentage: completionPercentage.toFixed(2) + "%"
    });

    const response = {
      success: true,
      message: "Advertisement completion details retrieved successfully",
      data: {
        ...completionAnalysis,
        completionPercentage: completionPercentage.toFixed(2),
        canMarkAsCompleted: completionAnalysis.completedReporters > 0,
        needsRefund: completionAnalysis.totalRefundAmount > 0
      }
    };

    console.log("✅ Completion analysis:", {
      totalReporters: completionAnalysis.totalReporters,
      completedReporters: completionAnalysis.completedReporters,
      incompleteReporters: completionAnalysis.incompleteReporters,
      totalRefundAmount: completionAnalysis.totalRefundAmount
    });

    res.status(200).json(response);

  } catch (error) {
    console.error("❌ Error getting advertisement completion details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = getAdvertisementCompletionDetails;
