const express = require("express");
const router = express.Router();

const { preRegisterUser, verifyOtp, resendOtp } = require('../../controller/pressConference/pressRegister');
const loginUser = require('../../controller/pressConference/pressLogin');

// Import free conference routes
const freeConferenceRoutes = require('./freeConferenceRoutes');
// Import paid conference routes
const paidConferenceRoutes = require('./paidConferenceRoutes');
// Import press wallet routes
const pressWalletRoutes = require('./pressWalletRoutes');
// Import press profile routes
const pressProfileRoutes = require('./pressProfileRoutes');
// Import press forget password routes
const pressForgetPasswordRoutes = require('./pressForgetPasswordRoutes');

// Press Conference Registration Routes
router.post("/press/register", preRegisterUser);
router.post("/press/verify-otp", verifyOtp);
router.post("/press/resend/otp", resendOtp);

// Press Conference Login Routes
router.post("/press/login", loginUser);

// Free Conference Routes
router.use("/press/free-conference", freeConferenceRoutes);
// Paid Conference Routes
router.use("/press/paid-conference", paidConferenceRoutes);

// Press Wallet Routes
router.use("/press/wallet", pressWalletRoutes);

// Press Profile Routes
router.use("/press", pressProfileRoutes);

// Press Forget Password Routes
router.use("/press", pressForgetPasswordRoutes);

// Test endpoints
router.get("/press/test", (req, res) => {
  res.json({ success: true, message: "Press Conference API is working!" });
});

router.get("/press/free-conference/test", (req, res) => {
  res.json({ success: true, message: "Free Conference API is working!" });
});

router.get("/press/paid-conference/test", (req, res) => {
  res.json({ success: true, message: "Paid Conference API is working!" });
});

module.exports = router;
