const Wallet = require("../../models/Wallet/walletSchema");
const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");

// Get press user wallet details
const getPressWalletDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log("Getting wallet details for press user:", userId);

    // Find user's wallet
    let wallet = await Wallet.findOne({
      userId: userId,
      userType: "PressConferenceUser"
    });

    // If wallet doesn't exist, create one with balance 0
    if (!wallet) {
      console.log("Creating new wallet for press user:", userId);
      wallet = new Wallet({
        userId: userId,
        userType: "PressConferenceUser",
        balance: 0,
        transactions: []
      });
      await wallet.save();
    }

    // Get user details for additional info
    const user = await PressConferenceUser.findById(userId);
    
    // Sort transactions by date (newest first)
    const sortedTransactions = wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`📊 Wallet details for press user ${userId}:
      - Balance: ₹${wallet.balance}
      - Total Transactions: ${wallet.transactions.length}
      - User: ${user?.name} (${user?.pressConferenceId})`);
    
    res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        transactions: sortedTransactions,
        user: {
          name: user?.name,
          email: user?.email,
          pressConferenceId: user?.pressConferenceId
        }
      }
    });

  } catch (error) {
    console.error("Error getting press wallet details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Press user withdrawal request
const pressWithdrawalRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountHolder, accountNumber, ifscCode, bankName, amount } = req.body;

    // Validate required fields
    if (!accountHolder || !accountNumber || !ifscCode || !bankName || !amount) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Validate amount
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    // Find user's wallet
    const wallet = await Wallet.findOne({
      userId: userId,
      userType: "PressConferenceUser"
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found"
      });
    }

    // Check if user has sufficient balance
    if (wallet.balance < withdrawalAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance"
      });
    }

    // Create withdrawal transaction
    const transaction = {
      type: "debit",
      amount: withdrawalAmount,
      description: `Withdrawal request to ${bankName} - ${accountNumber}`,
      date: new Date(),
      status: "pending",
      bankDetails: {
        accountHolder,
        accountNumber,
        ifscCode,
        bankName
      }
    };

    // Add transaction to wallet
    wallet.transactions.push(transaction);
    await wallet.save();

    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: {
        transactionId: transaction._id,
        amount: withdrawalAmount,
        status: "pending"
      }
    });

  } catch (error) {
    console.error("Error processing press withdrawal request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  getPressWalletDetails,
  pressWithdrawalRequest
};
