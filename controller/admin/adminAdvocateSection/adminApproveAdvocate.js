const AdvocateUser = require("../../../models/advocateUser/advocateUser");
const { sendEmail } = require("../../../utils/emailTemplates"); // Assuming email utility exists

// Approve Advocate
const approveAdvocate = async (req, res) => {
    try {
        const { id } = req.params;

        const advocate = await AdvocateUser.findById(id);

        if (!advocate) {
            return res.status(404).json({
                success: false,
                message: "Advocate not found",
            });
        }

        if (advocate.accountStatus === "Approved") {
            return res.status(400).json({
                success: false,
                message: "Advocate is already approved",
            });
        }

        advocate.accountStatus = "Approved";
        await advocate.save();

        // Send email notification
        try {
            await sendEmail(
                advocate.email,
                "Advocate Account Approved",
                `Dear ${advocate.name},\n\nYour advocate account has been approved by the admin. You can now log in to your dashboard.\n\nBest Regards,\nIINSAF Team`
            );
        } catch (emailErr) {
            console.error("Failed to send approval email:", emailErr);
        }

        return res.status(200).json({
            success: true,
            message: "Advocate approved successfully",
            data: advocate,
        });
    } catch (error) {
        console.error("Error approving advocate:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// Reject Advocate
const rejectAdvocate = async (req, res) => {
    try {
        const { id } = req.params;

        // Optional: Reason for rejection
        const { reason } = req.body;

        const advocate = await AdvocateUser.findById(id);

        if (!advocate) {
            return res.status(404).json({
                success: false,
                message: "Advocate not found",
            });
        }

        if (advocate.accountStatus === "Rejected") {
            return res.status(400).json({
                success: false,
                message: "Advocate is already rejected",
            });
        }

        advocate.accountStatus = "Rejected";
        await advocate.save();

        // Send email notification
        try {
            await sendEmail(
                advocate.email,
                "Advocate Account Rejected",
                `Dear ${advocate.name},\n\nYour advocate account has been rejected by the admin.${reason ? ` Reason: ${reason}` : ""}\n\nPlease contact support for more information.\n\nBest Regards,\nIINSAF Team`
            );
        } catch (emailErr) {
            console.error("Failed to send rejection email:", emailErr);
        }

        return res.status(200).json({
            success: true,
            message: "Advocate rejected successfully",
            data: advocate,
        });
    } catch (error) {
        console.error("Error rejecting advocate:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

module.exports = {
    approveAdvocate,
    rejectAdvocate
};
