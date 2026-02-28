const express = require("express");
const router = express.Router();

const { preRegisterUser, verifyOtp, resendOtp } = require('../../controller/user/registerUser')
const loginUser = require('../../controller/user/loginUser')
const checkReporterLogin = require('../../controller/user/checkLogin')
const userAuthenticate = require('../../middlewares/userAuthenticate/userAuthenticate')
const { getUserProfile, gotoDashboard } = require('../../controller/user/getUserProfile')
const { forgetPassword, verifyOtpAndResetPassword, setNewPassword, verifyOldPassword, updatePassword } = require("../../controller/user/forgetPassword")

const { registerRyvUser, verifyOtpForRyvUser } = require("../../controller/user/raiseYourVoiceUser/ryvRegister")
const ryvUserAuthenticate = require("../../middlewares/userAuthenticate/ryvUserAuthenticate")
const { ryvLogIn, ryvLoginOtp } = require("../../controller/user/raiseYourVoiceUser/ryvLogIn")

router.post("/register", preRegisterUser);
router.post("/verify-otp", verifyOtp);
router.post("/login", loginUser);
router.post("/login/check", checkReporterLogin);
router.get("/get/user/profile", userAuthenticate, getUserProfile);
router.get("/goto/dashboard", userAuthenticate, gotoDashboard)
router.post("/forget/password/send/otp", forgetPassword)
router.post("/verify/forget/password/otp", verifyOtpAndResetPassword);
router.post("/resend/otp", resendOtp);
router.post("/set/new/password", setNewPassword)

// Step 1: Verify old password
router.post("/user/password/verify-old", userAuthenticate, verifyOldPassword);
// Step 2: Update to new password
router.post("/user/password/update", userAuthenticate, updatePassword);


router.post("/raise/register", registerRyvUser)
router.post("/raise/verifyOtp", verifyOtpForRyvUser)
router.post("/raise/send/otp/login", ryvLogIn)
router.post("/raise/verify/otp/login", ryvLoginOtp);



module.exports = router;