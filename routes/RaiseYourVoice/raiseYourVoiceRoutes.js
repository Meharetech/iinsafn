const express = require("express");
const router = express.Router();

const ryvUserAuthenticate = require("../../middlewares/userAuthenticate/ryvUserAuthenticate");
const userProfile = require("../../controller/raiseYourVoice/userProfile");
const { ryvMediaUpload } = require("../../middlewares/multer/multer");
const ryvPost = require("../../controller/raiseYourVoice/ryvPost");
const {
  getUnderReviewRaiseYourVoice,
  getApprovedRaiseYourVoice,
  getRejectedRaiseYourVoice,
  getRunningRaiseYourVoice,
  getHistoryRaiseYourVoice,
  getRaiseYourVoiceStats,
} = require("../../controller/raiseYourVoice/ryvPostStatus");

router.post("/raise/voice/post", ryvUserAuthenticate, ryvMediaUpload, ryvPost);
router.get("/get/raise/ryv/user/profile", ryvUserAuthenticate, userProfile);

router.get(
  "/get/pending/ryv/post",
  ryvUserAuthenticate,
  getUnderReviewRaiseYourVoice
);
router.get(
  "/get/approved/ryv/post",
  ryvUserAuthenticate,
  getApprovedRaiseYourVoice
);
router.get(
  "/get/rejected/ryv/post",
  ryvUserAuthenticate,
  getRejectedRaiseYourVoice
);
router.get(
  "/get/running/ryv/post",
  ryvUserAuthenticate,
  getRunningRaiseYourVoice
);
router.get(
  "/get/history/ryv/post",
  ryvUserAuthenticate,
  getHistoryRaiseYourVoice
);
router.get(
  "/user/get/ryv/ad/stats",
  ryvUserAuthenticate,
  getRaiseYourVoiceStats
);

module.exports = router;
