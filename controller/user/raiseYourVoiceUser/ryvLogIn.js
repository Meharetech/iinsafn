const ryvUsers = require("../../../models/userModel/RaiseYourVoiceModel/raiseYourVoiceUsers");
const sendWhatsappOtp = require("../../../utils/sendWhatsappOtp");
const crypto = require("crypto");
const jwt = require("jsonwebtoken")

// const ryvLogIn = async (req, res) => {

//     console.log("that is data from req. body",req.body)
//     const { phoneNumber } = req.body;

//     try {
//         // const name = req.user?.name;
//         // console.log("that is the user from we get token",name);

//         if (!phoneNumber) {
//             return res.status(400).json({ message: "Phone number is missing" });
//         }

//         const user = await ryvUsers.findOne({ phoneNo: phoneNumber});

//         if (!user) {
//             return res.status(404).json({ message: "User not found with provided phone number" });
//         }

//         if (!user.isVerified) {
//             return res.status(403).json({ message: "User is not verified yet" });
//         }

//         // Generate 6-digit OTP
//         const otp = Math.floor(100000 + Math.random() * 900000).toString();

//         // Hash the OTP before storing
//         const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

//         user.loginOtp = hashedOtp;
//         user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

//         await user.save();

//         // Send OTP along with user's name
//         await sendWhatsappOtp(phoneNumber, otp); // <- send name too

//         res.status(200).json({
//             message: "OTP sent successfully",
//             phoneNumber: user.phoneNumber,
//         });
//     } catch (error) {
//         console.error("Error during login OTP flow:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// };





//exception handle



const ryvLogIn = async (req, res) => {
  console.log("RYV login request body:", req.body);
  const { phoneNumber } = req.body;

  try {
    // ✅ 1. Input validation
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format.",
      });
    }

    // ✅ 2. Check if user exists
    const user = await ryvUsers.findOne({ phoneNo: phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with the provided phone number.",
      });
    }

    // ✅ 3. Check verification status
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "User is not verified yet.",
      });
    }

    // ✅ 4. Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // ✅ 5. Hash OTP before storing
    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.loginOtp = hashedOtp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    await user.save();

    // ✅ 6. Send OTP safely
    try {
      await sendWhatsappOtp(phoneNumber, otp, user.name);
    } catch (waErr) {
      console.error("WhatsApp OTP sending failed:", waErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP via WhatsApp. Please try again later.",
      });
    }

    // ✅ 7. Success response
    res.status(200).json({
      success: true,
      message: "OTP sent successfully. Please verify within 10 minutes.",
      phoneNumber: user.phoneNo,
    });
  } catch (error) {
    console.error("Error during RYV login OTP flow:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};




const ryvLoginOtp = async (req, res) => {
    const { phoneNumber, loginOtp } = req.body;

    try {
        const user = await ryvUsers.findOne({ phoneNo: phoneNumber });

        if (!user || !user.loginOtp || !user.otpExpiry) {
            return res.status(400).json({ message: "Invalid request or OTP expired" });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({ message: "OTP expired" });
        }

        const hashedOtp = crypto.createHash("sha256").update(loginOtp).digest("hex");

        if (hashedOtp !== user.loginOtp) {
            return res.status(400).json({ message: "Incorrect OTP" });
        }

        user.loginOtp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {ryvLogIn, ryvLoginOtp}