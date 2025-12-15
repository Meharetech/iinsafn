const AdvocateUser = require("../../../models/advocateUser/advocateUser");

// Get all advocates for admin
const adminGetAllAdvocates = async (req, res) => {
    try {
        const advocates = await AdvocateUser.find().sort({ createdAt: -1 });

        if (!advocates || advocates.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No advocates found"
            });
        }

        return res.status(200).json({
            success: true,
            data: advocates,
            count: advocates.length,
            message: "Advocates fetched successfully"
        });
    } catch (error) {
        console.error("Error fetching advocates for admin:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = adminGetAllAdvocates;
