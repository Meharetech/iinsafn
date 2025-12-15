const AdvocateUser = require("../../../models/advocateUser/advocateUser");
const Wallet = require("../../../models/Wallet/walletSchema");

// Delete Advocate
const deleteAdvocate = async (req, res) => {
    try {
        const { id } = req.params;

        const advocate = await AdvocateUser.findById(id);

        if (!advocate) {
            return res.status(404).json({
                success: false,
                message: "Advocate not found",
            });
        }

        // Delete associated wallet
        await Wallet.findOneAndDelete({ userId: id });

        // Delete the advocate user
        await AdvocateUser.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Advocate deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting advocate:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

module.exports = deleteAdvocate;
