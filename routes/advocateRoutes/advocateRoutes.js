const express = require("express");
const router = express.Router();
const advocateAuth = require('../../middlewares/advocateAuth/advocateAuth');

const { preRegisterUser, verifyOtp, resendOtp } = require('../../controller/advocate/advocateRegister');
const loginUser = require('../../controller/advocate/advocateLogin');
const getProfile = require('../../controller/advocate/advocateProfile');
const getWalletDetails = require('../../controller/advocate/advocateWallet');
const getAllAdvocates = require('../../controller/advocate/getAllAdvocates');

// Public Routes
// Get all verified advocates for homepage display
router.get("/advocate/all", getAllAdvocates);

// Advocate Registration Routes
router.post("/advocate/register", preRegisterUser);
router.post("/advocate/verifyOtp", verifyOtp);
router.post("/advocate/resend-otp", resendOtp);

// Advocate Login Routes
router.post("/advocate/login", loginUser);

// Advocate Profile Routes (Protected)
router.get("/advocate/profile", advocateAuth, getProfile);

// Advocate Wallet Routes (Protected)
router.get("/advocate/wallet/detail", advocateAuth, getWalletDetails);

// Test endpoints
router.get("/advocate/test", (req, res) => {
  res.json({ success: true, message: "Advocate API is working!" });
});

module.exports = router;

