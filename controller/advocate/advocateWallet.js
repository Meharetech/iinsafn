const Wallet = require("../../models/Wallet/walletSchema");
const AdvocateUser = require("../../models/advocateUser/advocateUser");

// Get advocate wallet details
const getAdvocateWalletDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    console.log("Getting wallet details for advocate user:", userId);

    // Find user's wallet
    let wallet = await Wallet.findOne({
      userId: userId,
      userType: "AdvocateUser"
    });

    // If wallet doesn't exist, create one with balance 0
    if (!wallet) {
      console.log("Creating new wallet for advocate user:", userId);
      wallet = new Wallet({
        userId: userId,
        userType: "AdvocateUser",
        balance: 0,
        transactions: []
      });
      await wallet.save();
    }

    // Get user details for additional info
    const user = await AdvocateUser.findById(userId);
    
    // Sort transactions by date (newest first)
    const sortedTransactions = wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`📊 Wallet details for advocate user ${userId}:
      - Balance: ₹${wallet.balance}
      - Total Transactions: ${wallet.transactions.length}
      - User: ${user?.name} (${user?.advocateId})`);
    
    res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        transactions: sortedTransactions,
        user: {
          name: user?.name,
          email: user?.email,
          advocateId: user?.advocateId
        }
      }
    });

  } catch (error) {
    console.error("Error getting advocate wallet details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = getAdvocateWalletDetails;

