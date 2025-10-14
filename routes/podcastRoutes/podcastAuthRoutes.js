const express = require("express");
const router = express.Router();
const {
  registerPodcastUser,
  verifyPodcastOtp,
  sendPodcastLoginOtp,
  verifyPodcastLoginOtp,
  resendPodcastOtp,
  getPodcastUserProfile,
  updatePodcastUserProfile
} = require("../../controller/podcast/podcastAuthController");
const podcastAuthenticate = require("../../middlewares/podcastAuth/podcastAuthenticate");

// Public routes (no authentication required)
router.post("/register", registerPodcastUser);
router.post("/verifyOtp", verifyPodcastOtp);
router.post("/send/otp/login", sendPodcastLoginOtp);
router.post("/verify/otp/login", verifyPodcastLoginOtp);
router.post("/resend-otp", resendPodcastOtp);

// Protected routes (authentication required)
router.get("/profile", podcastAuthenticate, getPodcastUserProfile);
router.patch("/profile/update", podcastAuthenticate, updatePodcastUserProfile);

module.exports = router;

