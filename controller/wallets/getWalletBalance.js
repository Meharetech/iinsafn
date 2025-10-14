const wallet = require("../../models/Wallet/walletSchema");

const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    const userType = req.user.role;

    console.log("🔍 Wallet Balance Debug - User ID:", userId);
    console.log("🔍 Wallet Balance Debug - User Type:", userType);

    // Find wallet for the user
    const userWallet = await wallet.findOne({ 
      userId: userId,
      userType: userType 
    });

    if (!userWallet) {
      console.log("❌ Wallet not found for user:", userId);
      return res.status(404).json({
        success: false,
        message: "Wallet not found. Please contact support.",
        balance: 0
      });
    }

    console.log("✅ Wallet found - Balance:", userWallet.balance);

    return res.status(200).json({
      success: true,
      message: "Wallet balance retrieved successfully",
      balance: userWallet.balance,
      userType: userType,
      walletId: userWallet._id
    });

  } catch (error) {
    console.error("❌ Error fetching wallet balance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching wallet balance",
      error: error.message,
      balance: 0
    });
  }
};

module.exports = getWalletBalance;
