const PaidConference = require("../../../models/pressConference/paidConference");
const User = require("../../../models/userModel/userModel");
const Wallet = require("../../../models/Wallet/walletSchema");
const mongoose = require("mongoose");

// Accept paid conference
const acceptPaidConference = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const reporterId = req.user._id;
    
    console.log("Accepting paid conference:", conferenceId, "by reporter:", reporterId);

    // Find the paid conference
    const conference = await PaidConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Paid conference not found"
      });
    }

    // Check if conference is approved/modified and paid
    if (!["approved", "modified"].includes(conference.status) || conference.paymentStatus !== "paid") {
      console.log("Conference status check failed:", {
        status: conference.status,
        paymentStatus: conference.paymentStatus,
        conferenceId: conference.conferenceId
      });
      return res.status(400).json({
        success: false,
        message: "Conference is not available for acceptance"
      });
    }

    // Get reporter details
    const reporter = await User.findById(reporterId);
    if (!reporter) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if reporter is excluded by admin
    if (conference.excludedReporters && conference.excludedReporters.length > 0) {
      const isExcluded = conference.excludedReporters.some(
        excludedId => excludedId.toString() === reporterId.toString()
      );
      if (isExcluded) {
        console.log(`Reporter ${reporterId} is excluded from paid conference ${conferenceId} by admin`);
        return res.status(403).json({
          success: false,
          message: "This conference is not available for you. You have been removed from this conference by the admin.",
        });
      }
    }

    // Check if reporter is already accepted or rejected
    const alreadyAccepted = conference.acceptedReporters?.some(
      (r) => r.reporterId.toString() === reporterId.toString()
    );
    const alreadyRejected = conference.rejectedReporters?.some(
      (r) => r.reporterId.toString() === reporterId.toString()
    );

    if (alreadyAccepted) {
      return res.status(400).json({
        success: false,
        message: "You have already accepted this conference"
      });
    }

    if (alreadyRejected) {
      return res.status(400).json({
        success: false,
        message: "You have already rejected this conference"
      });
    }

    // 🔑 CRITICAL FIX: Use MongoDB transaction to prevent race condition
    const requiredReporters = conference.numberOfReporters || 0;
    
    // Start MongoDB transaction for atomic operation
    const session = await mongoose.startSession();
    let updatedConference = null;
    
    try {
      await session.withTransaction(async () => {
        // Use findOneAndUpdate with atomic conditions to prevent race condition
        updatedConference = await PaidConference.findOneAndUpdate(
          {
            conferenceId: conferenceId,
            // Ensure conference is still available for acceptance
            status: { $in: ["approved", "modified"] },
            paymentStatus: "paid",
            // CRITICAL: Only allow if current accepted count is less than required
            $expr: { $lt: [{ $size: { $ifNull: ["$acceptedReporters", []] } }, requiredReporters] },
            // Ensure this reporter hasn't already accepted or rejected
            "acceptedReporters.reporterId": { $ne: reporterId },
            "rejectedReporters.reporterId": { $ne: reporterId }
          },
          {
            $push: {
              acceptedReporters: {
                reporterId: reporterId,
                reporterName: reporter.name,
                reporterEmail: reporter.email,
                acceptedAt: new Date(),
                status: "accepted"
              }
            }
          },
          {
            new: true,
            runValidators: true,
            session: session
          }
        );
        
        if (!updatedConference) {
          throw new Error("Conference not available for acceptance");
        }
        
        // Update status to "running" if we now have enough reporters
        const currentAcceptedCount = updatedConference.acceptedReporters.length;
        if (currentAcceptedCount >= requiredReporters) {
          await PaidConference.findOneAndUpdate(
            { conferenceId: conferenceId },
            { $set: { status: "running" } },
            { session: session }
          );
          updatedConference.status = "running";
          console.log("✅ Status changed to 'running' - required reporters filled");
        }
      });
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    } finally {
      await session.endSession();
    }

    // Check if the update was successful
    if (!updatedConference) {
      console.log("Failed to accept conference - likely race condition or invalid state:", {
        conferenceId: conferenceId,
        reporterId: reporterId,
        requiredReporters: requiredReporters
      });
      return res.status(400).json({
        success: false,
        message: "Conference is no longer available for acceptance. It may have reached the required number of reporters or you may have already responded."
      });
    }

    // Status update is now handled within the transaction above

    console.log("✅ Conference accepted successfully with atomic operation:", {
      conferenceId: updatedConference.conferenceId,
      status: updatedConference.status,
      acceptedReporters: updatedConference.acceptedReporters.length,
      requiredReporters: requiredReporters
    });

    res.status(200).json({
      success: true,
      message: "Paid conference accepted successfully",
      data: updatedConference
    });
  } catch (error) {
    console.error("Error accepting paid conference:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Reject paid conference
const rejectPaidConference = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const { rejectNote } = req.body;
    const reporterId = req.user._id;
    
    console.log("Rejecting paid conference:", conferenceId, "by reporter:", reporterId);

    // Validate reject note
    if (!rejectNote || rejectNote.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Rejection note is required"
      });
    }

    // Find the paid conference
    const conference = await PaidConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Paid conference not found"
      });
    }

    // Check if conference is approved/modified and paid
    if (!["approved", "modified"].includes(conference.status) || conference.paymentStatus !== "paid") {
      console.log("Conference status check failed for rejection:", {
        status: conference.status,
        paymentStatus: conference.paymentStatus,
        conferenceId: conference.conferenceId
      });
      return res.status(400).json({
        success: false,
        message: "Conference is not available for rejection"
      });
    }

    // Get reporter details
    const reporter = await User.findById(reporterId);
    if (!reporter) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if reporter is excluded by admin
    if (conference.excludedReporters && conference.excludedReporters.length > 0) {
      const isExcluded = conference.excludedReporters.some(
        excludedId => excludedId.toString() === reporterId.toString()
      );
      if (isExcluded) {
        console.log(`Reporter ${reporterId} is excluded from paid conference ${conferenceId} by admin`);
        return res.status(403).json({
          success: false,
          message: "This conference is not available for you. You have been removed from this conference by the admin.",
        });
      }
    }

    // Check if reporter is already accepted or rejected
    const alreadyAccepted = conference.acceptedReporters?.some(
      (r) => r.reporterId.toString() === reporterId.toString()
    );
    const alreadyRejected = conference.rejectedReporters?.some(
      (r) => r.reporterId.toString() === reporterId.toString()
    );

    if (alreadyAccepted) {
      return res.status(400).json({
        success: false,
        message: "You have already accepted this conference"
      });
    }

    if (alreadyRejected) {
      return res.status(400).json({
        success: false,
        message: "You have already rejected this conference"
      });
    }

    // Add reporter to rejected list
    if (!conference.rejectedReporters) {
      conference.rejectedReporters = [];
    }

    conference.rejectedReporters.push({
      reporterId: reporterId,
      reporterName: reporter.name,
      reporterEmail: reporter.email,
      rejectedAt: new Date(),
      rejectNote: rejectNote.trim(),
      status: "rejected"
    });

    await conference.save();

    console.log("Paid conference rejected successfully");

    res.status(200).json({
      success: true,
      message: "Paid conference rejected successfully",
      data: conference
    });
  } catch (error) {
    console.error("Error rejecting paid conference:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Helper function to credit reporter's wallet
const creditReporterWallet = async (reporterId, amount, conferenceId) => {
  try {
    console.log(`Crediting reporter wallet:
      Reporter ID: ${reporterId}
      Amount: ₹${amount}
      Conference ID: ${conferenceId}`);
    
    // Find or create reporter's wallet
    let wallet = await Wallet.findOne({
      userId: reporterId,
      userType: "Reporter"
    });
    
    if (!wallet) {
      wallet = new Wallet({
        userId: reporterId,
        userType: "Reporter",
        balance: 0
      });
    }
    
    // Credit amount to wallet
    wallet.balance = Number(wallet.balance || 0) + Number(amount);
    wallet.transactions.push({
      type: "credit",
      amount: amount,
      description: `Payment for paid conference: ${conferenceId}`,
      status: "success",
      date: new Date()
    });
    
    await wallet.save();
    
    console.log(`Reporter wallet credited successfully. New balance: ₹${wallet.balance}`);
    
  } catch (error) {
    console.error("Error crediting reporter wallet:", error);
    throw error;
  }
};

module.exports = {
  acceptPaidConference,
  rejectPaidConference
};
