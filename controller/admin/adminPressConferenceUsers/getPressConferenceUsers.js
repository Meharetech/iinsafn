const PressConferenceUser = require("../../../models/pressConferenceUser/pressConferenceUser");
const Wallet = require("../../../models/Wallet/walletSchema");
const FreeConference = require("../../../models/pressConference/freeConference");

const getAllPressConferenceUsers = async (req, res) => {
    try {
        const users = await PressConferenceUser.find().sort({ createdAt: -1 });

        const enrichedUsers = await Promise.all(
            users.map(async (user) => {
                // Wallet balance
                const wallet = await Wallet.findOne({ userId: user._id, userType: "PressConferenceUser" });
                const walletBalance = wallet ? wallet.balance : 0;

                // Count submissions
                const totalSubmissions = await FreeConference.countDocuments({ submittedBy: user._id });
                const pendingSubmissions = await FreeConference.countDocuments({ submittedBy: user._id, status: "pending" });
                const approvedSubmissions = await FreeConference.countDocuments({ submittedBy: user._id, status: "approved" });
                const completedSubmissions = await FreeConference.countDocuments({ submittedBy: user._id, status: "completed" });

                return {
                    ...user.toObject(),
                    walletBalance,
                    totalSubmissions,
                    pendingSubmissions,
                    approvedSubmissions,
                    completedSubmissions,
                };
            })
        );

        return res.status(200).json({
            success: true,
            count: enrichedUsers.length,
            data: enrichedUsers,
        });
    } catch (error) {
        console.error("Error fetching press conference users:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Could not fetch press conference users.",
            error: error.message,
        });
    }
};

module.exports = { getAllPressConferenceUsers };
