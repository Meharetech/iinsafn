const express = require("express");
const router = express.Router();


//regular Ads
const reporterGetAllAds = require('../../controller/reporter/reporterGetAllAds')
const userAuthenticate = require('../../middlewares/userAuthenticate/userAuthenticate')
const createIdCard = require('../../controller/reporter/createIdCard')
const { reporterIdCardUpload } = require('../../middlewares/multer/multer')
const getIdCad = require("../../controller/reporter/getIdCard")
const {acceptAd , rejectAd} = require("../../controller/reporter/reporterAcceptOrRejectAd")
const {getAcceptedAds,getRejectedAds} = require("../../controller/reporter/getAcceptedAds")
const {reporterProofUpload} = require("../../middlewares/multer/multer")
const {submitAdProof, reporterGetRunningAds, reporterGetCompletedAds} = require("../../controller/reporter/submitAdProof")
const qrProfile = require("../../controller/reporter/qrProfile")
const checkVideosView = require("../../controller/reporter/checkVideosView")
const submitComplitedAds = require('../../controller/reporter/submitComplitedAds')
const reporterWithdrawal = require('../../controller/wallets/reporterWithdrawal')
const getTodaysApprovedAds =require("../../controller/reporter/getTodaysApprovedAds")
const checkIdCard = require("../../controller/reporter/checkIdCard")


//Free ads
const getfreeAds = require("../../controller/reporter/freeAds/getFreeAds")
const acceptFreeAd = require("../../controller/reporter/freeAds/acceptFreeAd")
const {getFreeAcceptedAds,reporterGetFreeRunningAds} = require('../../controller/reporter/freeAds/getFreeAcceptedAds')
const uploadFreeAdProof = require('../../controller/reporter/freeAds/uploadFreeAdProof')
const reporterGetRejectedAds = require('../../controller/reporter/freeAds/reporterGetRejectedAds')
const getFreeCompletedAds = require("../../controller/reporter/freeAds/getFreeCompletedAds")
const getInfluencerCompletedFreeAds = require("../../controller/influencer/freeAds/getInfluencerCompletedFreeAds")
const deleteMyProof = require("../../controller/reporter/freeAds/deleteMyProof")


// Raise your voice ads
const {getApprovedAdsForReporter,submitReporterProof, reporterAcceptRyvAd, reporterRejectRyvAd, reporterGetAcceptedRyvAd, updateProof, getRejectedAdsForReporter, getRunningRyvProofsForReporter,ReporterGetCompletedRyvProofs, getReporterRyvAdCounts, testReporterAccept} = require("../../controller/reporter/raiseYourVoice/getVoiceByStatus")

// Conference system
const {getNewConferences, getAcceptedConferences, getRejectedConferences, getCompletedConferences} = require("../../controller/reporter/conference/getReporterConferences")
const {acceptConference, rejectConference} = require("../../controller/reporter/conference/reporterAcceptRejectConference")
const getReporterConferenceStats = require("../../controller/reporter/conference/reporterConferenceStats")

// Conference proof submission
const {submitConferenceProof, getConferenceProof} = require("../../controller/reporter/conference/submitConferenceProof")

// Paid Conference system
const {getNewPaidConferences, getAcceptedPaidConferences, getRejectedPaidConferences, getCompletedPaidConferences, getPaidConferenceStats} = require("../../controller/reporter/paidConference/getReporterPaidConferences")
const {acceptPaidConference, rejectPaidConference} = require("../../controller/reporter/paidConference/reporterAcceptRejectPaidConference")
const {submitPaidConferenceProof} = require("../../controller/reporter/paidConference/submitPaidConferenceProof")


// regular dashboard stats
const getReporterAdCounts = require("../../controller/reporter/reporterDashboradStas")


// free ads dashboard stats
const getFreeAdCounts = require("../../controller/reporter/freeAds/freeAdStats")


//regular Ads Routes

router.post('/reporter/create/icard',reporterIdCardUpload,userAuthenticate,createIdCard);
router.get('/reporter/get/icard',userAuthenticate,getIdCad)
router.get('/reporter/get/new/ads',userAuthenticate,reporterGetAllAds)
router.put('/ad/accepted/:adId',userAuthenticate,(req, res, next) => {
  console.log("🔍 Route Debug - Accept ad route hit");
  console.log("🔍 Route Debug - Ad ID:", req.params.adId);
  console.log("🔍 Route Debug - User:", req.user);
  next();
}, acceptAd);
router.put('/ad/rejected/:adId',userAuthenticate,rejectAd)
router.get('/get/accepted/ads',userAuthenticate,getAcceptedAds);
router.get('/get/rejected/ads',userAuthenticate,getRejectedAds)
router.post('/reporter/submit/proof',userAuthenticate,reporterProofUpload,submitAdProof)
router.get('/reporter/get/running/ads',userAuthenticate,reporterGetRunningAds);
router.get('/reporter/get/completed/ads',userAuthenticate,reporterGetCompletedAds)
router.post('/reporter/submit/completed/ad',userAuthenticate,reporterProofUpload,submitComplitedAds)
router.post("/wallet/withdraw", userAuthenticate, reporterWithdrawal);
router.post('/check/current/view',checkVideosView)

router.get("/check/idcard", userAuthenticate, checkIdCard);

//when anyone can scan the qr for seeing reporter's profile 
router.get("/reporter/view/:id",qrProfile)
// public route for first time video will uploaded automaticly to iinsaf youtube channel
router.get("/ads/approved-today", getTodaysApprovedAds);

// reporter get regular ads dashboard stats
router.get("/reporter/get/dashboard/stats",userAuthenticate,getReporterAdCounts)


//free ad section

router.get('/reporter/new/free/ad',userAuthenticate,getfreeAds)
router.put('/reporter/free/ad/accepted/:adId',userAuthenticate,acceptFreeAd)
router.get('/reporter/get/free/accepted/ads',userAuthenticate,getFreeAcceptedAds);
router.post('/reporter/submit/proof/free/ad',userAuthenticate,reporterProofUpload,uploadFreeAdProof)
router.get('/reporter/get/running/free/ads',userAuthenticate,reporterGetFreeRunningAds)
router.get('/reporter/get/rejected/ads',userAuthenticate,reporterGetRejectedAds)
router.get('/reporter/get/completed/free/ads',userAuthenticate,getFreeCompletedAds)
router.delete('/reporter/delete/proof/:adId',userAuthenticate,deleteMyProof)

router.get("/reporter/get/free/ad/stats",userAuthenticate,getFreeAdCounts)

// Influencer Free Ads Routes - Using separate influencer controllers
const getInfluencerFreeAds = require('../../controller/influencer/freeAds/getInfluencerFreeAds')
const acceptInfluencerFreeAd = require('../../controller/influencer/freeAds/acceptInfluencerFreeAd')
const { getInfluencerAcceptedFreeAds, influencerGetFreeRunningAds } = require('../../controller/influencer/freeAds/getInfluencerAcceptedFreeAds')

router.get('/influencer/get/free/ad/stats',userAuthenticate,getFreeAdCounts)
router.get('/influencer/new/free/ad',userAuthenticate,getInfluencerFreeAds) // ✅ Now uses dedicated influencer controller
router.put('/influencer/free/ad/accepted/:adId',userAuthenticate,acceptInfluencerFreeAd) // ✅ Now uses dedicated influencer controller
router.get('/influencer/get/free/accepted/ads',userAuthenticate,getInfluencerAcceptedFreeAds); // ✅ Now uses dedicated influencer controller
router.post('/influencer/submit/proof/free/ad',userAuthenticate,reporterProofUpload,uploadFreeAdProof)
router.get('/influencer/get/running/free/ads',userAuthenticate,influencerGetFreeRunningAds) // ✅ Now uses dedicated influencer controller
router.get('/influencer/get/rejected/ads',userAuthenticate,reporterGetRejectedAds)
router.get('/influencer/get/completed/free/ads',userAuthenticate,getInfluencerCompletedFreeAds) // ✅ Now uses dedicated influencer controller
router.delete('/influencer/delete/proof/:adId',userAuthenticate,deleteMyProof)




//Raise your voice section

router.get("/reporter/get/new/voice",userAuthenticate,getApprovedAdsForReporter)
router.get("/reporter/get/accepted/ryv/ads",userAuthenticate,reporterGetAcceptedRyvAd)
router.post("/reporter/ryv/post/submit/proof",userAuthenticate,submitReporterProof)
router.put("/reporter/accept/ryv/ad/:adId",userAuthenticate,reporterAcceptRyvAd)
router.put("/reporter/reject/ryv/ad/:adId",userAuthenticate,reporterRejectRyvAd)
router.get("/reporter/get/rejected/ryv/ads",userAuthenticate,getRejectedAdsForReporter)
router.put('/reporter/update/proof/:adId',userAuthenticate,updateProof)
router.get('/reporter/get/ryv/stats',userAuthenticate,getReporterRyvAdCounts)
router.get("/reporter/get/running/ryv/proofs", userAuthenticate, getRunningRyvProofsForReporter);
router.get("/reporter/get/completed/ryv/proofs", userAuthenticate, ReporterGetCompletedRyvProofs);
router.get("/reporter/test/accept", userAuthenticate, testReporterAccept);

// Conference routes
router.get("/reporter/get/new/conferences", userAuthenticate, getNewConferences);
router.get("/reporter/get/accepted/conferences", userAuthenticate, getAcceptedConferences);
router.get("/reporter/get/rejected/conferences", userAuthenticate, getRejectedConferences);
router.get("/reporter/get/completed/conferences", userAuthenticate, getCompletedConferences);
router.put("/reporter/accept/conference/:conferenceId", userAuthenticate, acceptConference);
router.put("/reporter/reject/conference/:conferenceId", userAuthenticate, rejectConference);
router.get("/reporter/get/conference/stats", userAuthenticate, getReporterConferenceStats);

// Conference proof submission routes
router.post("/reporter/submit/conference/proof/:conferenceId", userAuthenticate, reporterProofUpload, submitConferenceProof);
router.get("/reporter/get/conference/proof/:conferenceId", userAuthenticate, getConferenceProof);

// Paid Conference routes
router.get("/reporter/get/new/paid-conferences", userAuthenticate, getNewPaidConferences);
router.get("/reporter/get/accepted/paid-conferences", userAuthenticate, getAcceptedPaidConferences);
router.get("/reporter/get/rejected/paid-conferences", userAuthenticate, getRejectedPaidConferences);
router.get("/reporter/get/completed/paid-conferences", userAuthenticate, getCompletedPaidConferences);
router.put("/reporter/accept/paid-conference/:conferenceId", userAuthenticate, acceptPaidConference);
router.put("/reporter/reject/paid-conference/:conferenceId", userAuthenticate, rejectPaidConference);
router.get("/reporter/get/paid-conference/stats", userAuthenticate, getPaidConferenceStats);
router.post("/reporter/submit/paid-conference/proof/:conferenceId", userAuthenticate, submitPaidConferenceProof);

// Influencer Routes (same functionality as reporter)
router.post('/influencer/create/icard',reporterIdCardUpload,userAuthenticate,createIdCard);
router.get('/influencer/get/icard',userAuthenticate,getIdCad)
router.get("/influencer/check/idcard", userAuthenticate, checkIdCard);
router.get('/influencer/get/new/ads',userAuthenticate,reporterGetAllAds)
router.put('/influencer/ad/accepted/:adId',userAuthenticate,acceptAd);
router.put('/influencer/ad/rejected/:adId',userAuthenticate,rejectAd)
router.get('/influencer/get/accepted/ads',userAuthenticate,getAcceptedAds);
router.get('/influencer/get/rejected/ads',userAuthenticate,getRejectedAds)
router.post('/influencer/submit/proof',userAuthenticate,reporterProofUpload,submitAdProof)
router.get('/influencer/get/running/ads',userAuthenticate,reporterGetRunningAds);
router.get('/influencer/get/completed/ads',userAuthenticate,reporterGetCompletedAds)
router.get('/influencer/get/dashboard/stats',userAuthenticate,getReporterAdCounts)

// Influencer wallet routes
router.get('/influencer/wallet/balance',userAuthenticate,require('../../controller/wallets/getWalletBalance'))
router.post('/influencer/withdrawal/request',userAuthenticate,reporterWithdrawal)

// Influencer Raise Your Voice Routes
router.get("/influencer/get/new/voice",userAuthenticate,getApprovedAdsForReporter)
router.get("/influencer/get/accepted/ryv/ads",userAuthenticate,reporterGetAcceptedRyvAd)
router.post("/influencer/ryv/post/submit/proof",userAuthenticate,submitReporterProof)
router.put("/influencer/accept/ryv/ad/:adId",userAuthenticate,reporterAcceptRyvAd)
router.put("/influencer/reject/ryv/ad/:adId",userAuthenticate,reporterRejectRyvAd)
router.get("/influencer/get/rejected/ryv/ads",userAuthenticate,getRejectedAdsForReporter)
router.put('/influencer/update/proof/:adId',userAuthenticate,updateProof)
router.get('/influencer/get/ryv/stats',userAuthenticate,getReporterRyvAdCounts)
router.get("/influencer/get/running/ryv/proofs", userAuthenticate, getRunningRyvProofsForReporter);
router.get("/influencer/get/completed/ryv/proofs", userAuthenticate, ReporterGetCompletedRyvProofs);

module.exports = router