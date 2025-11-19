require("dotenv").config();
const PaymentHistory = require("../../models/paymentHistory/paymentHistory");
const Wallet = require("../../models/Wallet/walletSchema");
const WithdrawalRequest = require("../../models/WithdrawalRequest/withdrawalRequest");

/**
 * Clear selected data: payment history, wallets, withdrawal requests, withdrawal history
 * This is a DESTRUCTIVE operation - use with caution!
 * Accepts checkboxes in request body: { clearWallet, clearPaymentHistory, clearWithdrawalRequests, clearWithdrawalHistory }
 */
const clearAllPaymentsAndWallets = async (req, res) => {
  try {
    const { 
      clearWallet = false, 
      clearPaymentHistory = false, 
      clearWithdrawalRequests = false,
      clearWithdrawalHistory = false 
    } = req.body;

    console.log("🚨 Starting clear operation with options:", {
      clearWallet,
      clearPaymentHistory,
      clearWithdrawalRequests,
      clearWithdrawalHistory
    });

    // Validate at least one option is selected
    if (!clearWallet && !clearPaymentHistory && !clearWithdrawalRequests && !clearWithdrawalHistory) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one option to clear"
      });
    }
    
    const results = {
      wallet: { before: 0, after: 0, updated: 0 },
      paymentHistory: { before: 0, after: 0, deleted: 0 },
      withdrawalRequests: { before: 0, after: 0, deleted: 0 },
      withdrawalHistory: { before: 0, after: 0, deleted: 0 }
    };
    
    // Step 1: Get counts before deletion
    if (clearPaymentHistory) {
      results.paymentHistory.before = await PaymentHistory.countDocuments();
    }
    
    if (clearWallet) {
      results.wallet.before = await Wallet.countDocuments();
    }
    
    if (clearWithdrawalRequests) {
      results.withdrawalRequests.before = await WithdrawalRequest.countDocuments({ status: "pending" });
    }
    
    if (clearWithdrawalHistory) {
      results.withdrawalHistory.before = await WithdrawalRequest.countDocuments({ status: "approved" });
    }

    console.log(`📊 Before clearing:`, results);

    // Step 2: Delete payment history if selected
    if (clearPaymentHistory) {
      const deletePaymentHistoryResult = await PaymentHistory.deleteMany({});
      results.paymentHistory.deleted = deletePaymentHistoryResult.deletedCount;
      results.paymentHistory.after = await PaymentHistory.countDocuments();
      console.log(`✅ Deleted ${deletePaymentHistoryResult.deletedCount} payment history records`);
    }

    // Step 3: Reset wallets if selected
    if (clearWallet) {
      const updateWalletsResult = await Wallet.updateMany(
        {},
        {
          $set: {
            balance: 0,
            transactions: []
          }
        }
      );
      results.wallet.updated = updateWalletsResult.modifiedCount;
      results.wallet.after = await Wallet.find({ balance: { $ne: 0 } }).countDocuments();
      console.log(`✅ Updated ${updateWalletsResult.modifiedCount} wallets - Balance set to 0, transactions cleared`);
    }

    // Step 4: Delete withdrawal requests (pending) if selected
    if (clearWithdrawalRequests) {
      const deleteWithdrawalRequestsResult = await WithdrawalRequest.deleteMany({ status: "pending" });
      results.withdrawalRequests.deleted = deleteWithdrawalRequestsResult.deletedCount;
      results.withdrawalRequests.after = await WithdrawalRequest.countDocuments({ status: "pending" });
      console.log(`✅ Deleted ${deleteWithdrawalRequestsResult.deletedCount} pending withdrawal requests`);
    }

    // Step 5: Delete withdrawal history (approved) if selected
    if (clearWithdrawalHistory) {
      const deleteWithdrawalHistoryResult = await WithdrawalRequest.deleteMany({ status: "approved" });
      results.withdrawalHistory.deleted = deleteWithdrawalHistoryResult.deletedCount;
      results.withdrawalHistory.after = await WithdrawalRequest.countDocuments({ status: "approved" });
      console.log(`✅ Deleted ${deleteWithdrawalHistoryResult.deletedCount} approved withdrawal history records`);
    }

    // Generate success message based on what was cleared
    const clearedItems = [];
    if (clearPaymentHistory) clearedItems.push("payment history");
    if (clearWallet) clearedItems.push("wallets");
    if (clearWithdrawalRequests) clearedItems.push("withdrawal requests");
    if (clearWithdrawalHistory) clearedItems.push("withdrawal history");
    
    const message = `Successfully cleared: ${clearedItems.join(", ")}`;

    console.log(`📊 After clearing:`, results);

    res.status(200).json({
      success: true,
      message: message,
      data: {
        cleared: {
          wallet: clearWallet,
          paymentHistory: clearPaymentHistory,
          withdrawalRequests: clearWithdrawalRequests,
          withdrawalHistory: clearWithdrawalHistory
        },
        results
      }
    });

  } catch (error) {
    console.error("❌ Error clearing data:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing data",
      error: error.message
    });
  }
};

/**
 * Get summary of current payment history, wallet status, withdrawal requests, and withdrawal history
 */
const getPaymentsAndWalletsSummary = async (req, res) => {
  try {
    // Payment History
    const paymentHistoryCount = await PaymentHistory.countDocuments();
    
    // Wallets
    const walletCount = await Wallet.countDocuments();
    const walletsWithBalance = await Wallet.find({ balance: { $gt: 0 } });
    const totalWalletBalance = walletsWithBalance.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
    const walletsWithTransactions = await Wallet.find({ 
      transactions: { $exists: true, $ne: [] } 
    });
    const totalTransactions = walletsWithTransactions.reduce((sum, wallet) => 
      sum + (wallet.transactions?.length || 0), 0);

    // Withdrawal Requests (pending)
    const withdrawalRequestsCount = await WithdrawalRequest.countDocuments({ status: "pending" });
    const pendingRequests = await WithdrawalRequest.find({ status: "pending" });
    const totalPendingAmount = pendingRequests.reduce((sum, req) => sum + (req.amount || 0), 0);

    // Withdrawal History (approved)
    const withdrawalHistoryCount = await WithdrawalRequest.countDocuments({ status: "approved" });
    const approvedWithdrawals = await WithdrawalRequest.find({ status: "approved" });
    const totalWithdrawnAmount = approvedWithdrawals.reduce((sum, req) => sum + (req.amount || 0), 0);

    // All withdrawal requests (all statuses)
    const totalWithdrawalRequests = await WithdrawalRequest.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        paymentHistory: {
          totalRecords: paymentHistoryCount
        },
        wallets: {
          totalWallets: walletCount,
          walletsWithBalance: walletsWithBalance.length,
          totalWalletBalance: totalWalletBalance,
          walletsWithTransactions: walletsWithTransactions.length,
          totalTransactions: totalTransactions
        },
        withdrawalRequests: {
          totalRequests: totalWithdrawalRequests,
          pendingRequests: withdrawalRequestsCount,
          totalPendingAmount: totalPendingAmount
        },
        withdrawalHistory: {
          totalRecords: withdrawalHistoryCount,
          totalWithdrawnAmount: totalWithdrawnAmount
        }
      }
    });
  } catch (error) {
    console.error("❌ Error getting summary:", error);
    res.status(500).json({
      success: false,
      message: "Error getting summary",
      error: error.message
    });
  }
};

module.exports = {
  clearAllPaymentsAndWallets,
  getPaymentsAndWalletsSummary
};

