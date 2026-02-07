const User = require("../../../models/userModel/userModel");
const Wallet = require("../../../models/Wallet/walletSchema");
const bcrypt = require("bcrypt");

/**
 * Update user details from admin panel
 */
const adminUpdateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, mobile, role, gender, state, city, pincode, residenceaddress, password } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update fields if provided
        if (name) user.name = name;
        if (email) user.email = email;
        if (mobile) user.mobile = mobile;
        if (role) user.role = role;
        if (gender) user.gender = gender;
        if (state) user.state = state;
        if (city) user.city = city;
        if (pincode) user.pincode = pincode;
        if (residenceaddress) user.residenceaddress = residenceaddress;

        // Update password if provided
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "User details updated successfully",
            data: user
        });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: "Server error updating user", error: error.message });
    }
};

/**
 * Delete user from admin panel
 */
const adminDeleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Also delete user's wallet if it exists
        await Wallet.deleteOne({ userId: id });

        // Delete user
        await User.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "User and associated wallet deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Server error deleting user", error: error.message });
    }
};

module.exports = { adminUpdateUser, adminDeleteUser };
