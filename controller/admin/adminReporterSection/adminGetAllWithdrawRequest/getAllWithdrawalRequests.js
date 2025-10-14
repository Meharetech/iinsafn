// controllers/wallet/getAllWithdrawalRequests.js
const WithdrawalRequest = require("../../../../models/WithdrawalRequest/withdrawalRequest");
const Wallet = require("../../../../models/Wallet/walletSchema");
const User = require("../../../../models/userModel/userModel");
const sendEmail = require("../../../../utils/sendEmail");
const notifyOnWhatsapp = require("../../../../utils/notifyOnWhatsapp");
const Templates = require("../../../../utils/whatsappTemplates");


const getAllWithdrawalRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({
      status: "pending",
    }).populate("reporterId", "name email iinsafId role");
    res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const approveWithdrawal = async (req, res) => {
  const { id } = req.params;

  try {
    const request = await WithdrawalRequest.findById(id);
    if (!request)
      return res.status(404).json({ message: "Withdrawal request not found" });

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    // Update request status
    request.status = "approved";
    await request.save();

    // Mark wallet transaction as "success"
    const wallet = await Wallet.findOne({
      userId: request.reporterId,
      userType: "Reporter",
    });
    if (wallet) {
      const tx = wallet.transactions.find(
        (t) =>
          t.amount === request.amount &&
          t.status === "pending" &&
          t.description === "Withdrawal requested"
      );
      if (tx) tx.status = "success";
      await wallet.save();
    }

    // ✅ Notify Reporter
    const reporter = await User.findById(request.reporterId);
    if (reporter) {
      await sendEmail(
        reporter.email,
        "Withdrawal Request Approved",
        `
        Your Withdrawal Request has been Approved ✅
        Amount:₹${request.amount}
        Status: Approved
        The requested amount will be processed shortly to your bank account.
        `
      );

      // 📱 WhatsApp notification
      if (reporter.mobile) {
        await notifyOnWhatsapp(
          reporter.mobile,
          Templates.NOTIFY_TO_REPORTER_AFTER_APPROVE_WITHDRAWAL_REQUEST, // ✅ AiSensy template
          [
            reporter.name, // {{1}} -> reporter name
            String(request.amount), // {{2}} -> withdrawal amount
          ]
        );
      }
    }

    res.status(200).json({ success: true, message: "Withdrawal approved" });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const rejectWithdrawal = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Find the withdrawal request
    const request = await WithdrawalRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "This request has already been processed" });
    }

    // 2. Mark the request as rejected
    request.status = "rejected";
    await request.save();

    // 3. Refund the amount back to reporter's wallet
    const wallet = await Wallet.findOne({
      userId: request.reporterId,
      userType: "Reporter",
    });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Add the amount back
    wallet.balance += request.amount;

    // Update the transaction to mark as "failed"
    const transaction = wallet.transactions.find(
      (tx) =>
        tx.amount === request.amount &&
        tx.status === "pending" &&
        tx.description === "Withdrawal requested"
    );
    if (transaction) {
      transaction.status = "failed";
      transaction.description = "Withdrawal rejected by admin";
    }

    await wallet.save();

    // ✅ Notify Reporter
    const reporter = await User.findById(request.reporterId);
    if (reporter) {
      await sendEmail(
        reporter.email,
        "Withdrawal Request Rejected",
        `
        Your Withdrawal Request has been Rejected ❌
        Amount:₹${request.amount}
        Status: Rejected
        The amount has been refunded back to your wallet.
        `
      );

      // 📱 WhatsApp notification
  if (reporter.mobile) {
    await notifyOnWhatsapp(
      reporter.mobile,
      Templates.NOTIFY_TO_REPORTER_AFTER_REJECTED_WITHDRAWAL_REQUEST, // ✅ AiSensy template
      [
        reporter.name,     // {{1}} -> reporter name
        String(request.amount)     // {{2}} -> rejected amount
      ]
    );
  }
    }

    return res.status(200).json({
      success: true,
      message: "Withdrawal request rejected and amount refunded to wallet",
    });
  } catch (err) {
    console.error("Error rejecting withdrawal:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal,
};
