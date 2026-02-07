const User = require("../../../models/userModel/userModel");
const RyvUsers = require("../../../models/userModel/RaiseYourVoiceModel/raiseYourVoiceUsers");
const GenrateIdCard = require("../../../models/reporterIdGenrate/genrateIdCard");
const Wallet = require("../../../models/Wallet/walletSchema");


// ✅ 1. Get Raise Your Voice users
const getRaiseYourVoiceUsers = async (req, res) => {
  try {
    const users = await RyvUsers.find();
    res.status(200).json({ count: users.length, users });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error fetching Raise Your Voice users",
        error: err.message,
      });
  }
};

// ✅ 2. Get all users (with details)
// const getTotalUsers = async (req, res) => {
//   try {
//     const users = await User.find();
//     res.status(200).json({ count: users.length, users });
//   } catch (err) {
//     res.status(500).json({ message: "Error fetching total users", error: err.message });
//   }
// };

const getTotalUsers = async (req, res) => {
  try {
    // Fetch all users
    const users = await User.find();

    // Enrich each user with iinsafId and walletBalance
    const usersWithIinsafId = await Promise.all(
      users.map(async (user) => {
        // Fetch wallet balance
        const wallet = await Wallet.findOne({ userId: user._id });
        const walletBalance = wallet ? wallet.balance : 0;

        // Fetch ID card info if it exists (Reporters, Influencers, etc.)
        const idCard = await GenrateIdCard.findOne(
          { reporter: user._id },
          "iinsafId status image"
        );

        let enrichedUser = {
          ...user.toObject(),
          walletBalance,
          iinsafId: idCard ? idCard.iinsafId : user.iinsafId,
          idCardStatus: idCard ? idCard.status : "Not Applied",
          profileImage: idCard ? idCard.image : null
        };

        return enrichedUser;
      })
    );


    res.status(200).json({
      count: usersWithIinsafId.length,
      users: usersWithIinsafId,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching total users",
      error: err.message,
    });
  }
};

// ✅ 3. Get all advertisers (with details)
const getTotalAdvertisers = async (req, res) => {
  try {
    const advertisers = await User.find({ role: "Advertiser" });

    const enrichedAdvertisers = await Promise.all(
      advertisers.map(async (user) => {
        const wallet = await Wallet.findOne({ userId: user._id });
        return {
          ...user.toObject(),
          walletBalance: wallet ? wallet.balance : 0
        };
      })
    );

    res.status(200).json({ count: enrichedAdvertisers.length, advertisers: enrichedAdvertisers });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching advertisers", error: err.message });
  }
};

// ✅ 4. Get unverified reporters (with details)
const getUnverifiedReporters = async (req, res) => {
  try {
    const unverifiedReporters = await User.find({
      role: "Reporter",
      verifiedReporter: false,
    });

    const enrichedReporters = await Promise.all(
      unverifiedReporters.map(async (user) => {
        const wallet = await Wallet.findOne({ userId: user._id });
        return {
          ...user.toObject(),
          walletBalance: wallet ? wallet.balance : 0
        };
      })
    );

    res
      .status(200)
      .json({ count: enrichedReporters.length, unverifiedReporters: enrichedReporters });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error fetching unverified reporters",
        error: err.message,
      });
  }
};


module.exports = {
  getRaiseYourVoiceUsers,
  getTotalUsers,
  getTotalAdvertisers,
  getUnverifiedReporters,
};
