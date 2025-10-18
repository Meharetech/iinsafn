const express = require("express");
const router = express.Router();

// const upload = require("../../middlewares/multer/multer")
const {advertiserUpload } = require("../../middlewares/multer/multer")
const userAuthenticate = require("../../middlewares/userAuthenticate/userAuthenticate")
const postAdd =require('../../controller/advertiser/postAdd')
const getPricing = require('../../controller/advertiser/getPricing')
const calculateFinalPrice = require('../../controller/advertiser/calculateFinalPrice')
const {adsPayment , successOrNot , payFromWallet , walletPaymentSuccess , walletTopUp} = require("../../controller/payments/adsPayment")
const {getAdvertisementsByStatus, getAllAds, getAdvertiserAcceptedReporters} = require('../../controller/advertiser/getAdvertisementsByStatus')
const getPaymentHistory = require('../../controller/payments/getPaymentHistory')
const checkCoupon = require("../../controller/advertiser/checkCoupon");
const getRunningAds  = require("../../controller/advertiser/getRunningAds");
const advertiserWalletDetail = require('../../controller/wallets/advertiserWalletDetail')
const advertiserGetCompletedAds = require("../../controller/advertiser/advertiserGetCompletedAds")
const checkVideoViews = require("../../controller/advertiser/checkVideoViews")



router.post("/advertiser/post/advertisement",advertiserUpload,userAuthenticate,postAdd);
router.get("/get/ad/pricing",getPricing)
router.post("/get/final/price",calculateFinalPrice);
router.post("/ads/payment",userAuthenticate,adsPayment)
router.post("/ads/wallet/payment",userAuthenticate,payFromWallet)
router.get("/payment/:paymentId",userAuthenticate,successOrNot)
router.get('/advertiser/advertisements', userAuthenticate, getAdvertisementsByStatus);
router.get('/advertiser/get/all/ads',userAuthenticate,getAllAds)
router.get('/payments/history',userAuthenticate,getPaymentHistory)
router.post("/apply/coupon",userAuthenticate,checkCoupon)
router.get('/get/running/ads',userAuthenticate,getRunningAds)
router.get('/get/wallet/detail',userAuthenticate,advertiserWalletDetail)
router.get('/advertiser/get/completed/ads',userAuthenticate,advertiserGetCompletedAds)
router.get('/advertiser/check/video-views/:adId',userAuthenticate,checkVideoViews)
router.get("/ads/accepted/by/reporters/for/advertiser", userAuthenticate, getAdvertiserAcceptedReporters);


//for add money in wallet
router.post("/wallet/topup", userAuthenticate, walletTopUp);
router.post("/wallet/success/:paymentId", userAuthenticate, walletPaymentSuccess);



module.exports = router;