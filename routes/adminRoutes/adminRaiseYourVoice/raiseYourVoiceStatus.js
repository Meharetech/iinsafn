const express = require("express");
const router = express.Router();

const adminAuthenticate = require("../../../middlewares/adminAuthenticate/adminAuthenticate");

const {
  getUnderReviewRyvAds,
  approveRyvAd,
  rejectRyvAd,
  getRunningRyvAds,
  getApprovedRyvAds,
  adminGetRejectedProofs,
  adminRejectTheProof,
  adminAcceptTheProof,
  getRyvAdsStatsForAdmin,
  adminGetRyvPostHistory,
  getAcceptedRyvProofs,
  getCompletedRyvAds,
  modifyRyvAd,
  getSingleRyvAd,
  getAllRyvAds,
  getRyvPostTargetedReporters,
  deleteReporterFromRyvPost
} = require("../../../controller/admin/adminRaiseYourVoice/raiseYourVoiceByStatus");

const { testInfluencers } = require("../../../controller/admin/adminRaiseYourVoice/testInfluencers");


router.get("/admin/get/new/ryv/ads", adminAuthenticate, getUnderReviewRyvAds);
router.put("/admin/approve/ryv/ad/:adId", adminAuthenticate, approveRyvAd);
router.get("/admin/get/approved/ads",adminAuthenticate,getApprovedRyvAds)
router.put("/admin/reject/ryv/ad/:adId", adminAuthenticate, rejectRyvAd);
router.get("/admin/get/running/ryv/ads", adminAuthenticate, getRunningRyvAds);
router.get("/admin/get/rejected/ads/by/reporter",adminAuthenticate,adminGetRejectedProofs)
router.put("/admin/accept/proof/:adId/:reporterId",adminAuthenticate,adminAcceptTheProof)
router.put("/admin/reject/proof/:proofId",adminAuthenticate,adminRejectTheProof)
router.get("/admin/get/all/ryv/ad/stats",adminAuthenticate,getRyvAdsStatsForAdmin)
router.get("/admin/get/ryv/history",adminGetRyvPostHistory)
router.get("/admin/get/ryv/accepted/by/reporters", adminAuthenticate, getAcceptedRyvProofs);
router.get("/admin/get/ryv/completed/ads", adminAuthenticate, getCompletedRyvAds);
router.put("/admin/modify/ryv/ad/:adId", adminAuthenticate, modifyRyvAd);
router.get("/admin/get/ryv/ad/:adId", adminAuthenticate, getSingleRyvAd);
router.get("/admin/get/all/ryv/posts", adminAuthenticate, getAllRyvAds);

// Get all reporters who have the Raise Your Voice post in their panel (targeted reporters)
router.get("/admin/get/ryv/post/:postId/targeted-reporters", 
  adminAuthenticate, 
  getRyvPostTargetedReporters
);

// Delete reporter from Raise Your Voice post
router.delete("/admin/delete/ryv/post/reporter/:postId/:reporterId",
  adminAuthenticate,
  deleteReporterFromRyvPost
);

// Test influencers endpoint
router.get("/admin/test/influencers",
  adminAuthenticate,
  testInfluencers
);

module.exports = router;
