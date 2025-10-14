const Wallet = require("../../models/Wallet/walletSchema");

const advertiserWalletDetail = async (req, res) => {
  const userId = req.user._id;
  const userType = req.user.role; // Should be "Advertiser", "Reporter", or "Influencer"

  try {
    const wallet = await Wallet.findOne({ userId, userType });

    if (!wallet) {
      return res.status(404).json({ message: "No wallet found for this user" });
    }

    res.status(200).json({
      balance: wallet.balance,
      transactions: wallet.transactions,
    });
  } catch (err) {
    console.error("Error fetching wallet:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = advertiserWalletDetail;
