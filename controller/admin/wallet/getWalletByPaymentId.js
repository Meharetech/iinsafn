const Wallet = require("../../../models/Wallet/walletSchema");
const User = require("../../../models/userModel/userModel");

/**
 * Admin API: Get wallet details by payment ID
 * This finds the wallet that contains a transaction with the given payment ID
 */
const getWalletByPaymentId = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    console.log(`🔍 Admin fetching wallet details for payment ID: ${paymentId}`);

    // Find wallet that has a transaction with this payment ID
    const wallet = await Wallet.findOne({
      "transactions.paymentId": paymentId
    })
    .populate("userId", "name email mobile iinsafId role organization");

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found for this payment ID"
      });
    }

    // Find the specific transaction
    const transaction = wallet.transactions.find(
      t => t.paymentId === paymentId
    );

    // Sort transactions by date (newest first)
    const sortedTransactions = wallet.transactions.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    console.log(`✅ Wallet found for payment ID ${paymentId}:`, {
      walletId: wallet._id,
      userId: wallet.userId?._id,
      userType: wallet.userType,
      balance: wallet.balance,
      totalTransactions: wallet.transactions.length
    });

    res.status(200).json({
      success: true,
      data: {
        wallet: {
          _id: wallet._id,
          userId: wallet.userId,
          userType: wallet.userType,
          balance: wallet.balance,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt
        },
        user: wallet.userId ? {
          _id: wallet.userId._id,
          name: wallet.userId.name,
          email: wallet.userId.email,
          mobile: wallet.userId.mobile,
          iinsafId: wallet.userId.iinsafId,
          role: wallet.userId.role,
          organization: wallet.userId.organization
        } : null,
        transaction: transaction ? {
          type: transaction.type,
          amount: transaction.amount,
          paymentId: transaction.paymentId,
          refundId: transaction.refundId,
          description: transaction.description,
          date: transaction.date,
          status: transaction.status,
          bankDetails: transaction.bankDetails,
          withdrawalRequestId: transaction.withdrawalRequestId
        } : null,
        allTransactions: sortedTransactions.map(t => ({
          type: t.type,
          amount: t.amount,
          paymentId: t.paymentId,
          refundId: t.refundId,
          description: t.description,
          date: t.date,
          status: t.status,
          bankDetails: t.bankDetails,
          withdrawalRequestId: t.withdrawalRequestId
        }))
      }
    });

  } catch (error) {
    console.error("❌ Error fetching wallet by payment ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = getWalletByPaymentId;

