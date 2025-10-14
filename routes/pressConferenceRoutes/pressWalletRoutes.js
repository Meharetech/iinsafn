const express = require("express");
const router = express.Router();
const { getPressWalletDetails, pressWithdrawalRequest } = require("../../controller/pressConference/pressWalletController");
const pressConferenceAuth = require("../../middlewares/pressConferenceAuth/pressConferenceAuth");

// Get press user wallet details
router.get("/detail", pressConferenceAuth, getPressWalletDetails);

// Press user withdrawal request
router.post("/withdraw", pressConferenceAuth, pressWithdrawalRequest);

module.exports = router;
