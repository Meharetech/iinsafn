const express = require("express");
const router = express.Router();
const { getPressProfile, updatePressProfile } = require("../../controller/pressConference/pressProfileController");
const pressConferenceAuth = require("../../middlewares/pressConferenceAuth/pressConferenceAuth");

// Get press user profile
router.get("/profile", pressConferenceAuth, getPressProfile);

// Update press user profile
router.put("/profile/update", pressConferenceAuth, updatePressProfile);

module.exports = router;
