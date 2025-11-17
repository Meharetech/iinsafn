const express = require("express");
const router = express.Router();

const {
  adminSetAdPrice,
  fbVideoUpload,
  acceptingAdTimeing,
  setReporterPrice,
  setPaidConferenceCommission,
} = require("../../../controller/admin/adminAdevertismentSection/adminSetAdPrice/adminSetAdPrice");
const {
  adminGetAds,
  approvedAds,
  rejectedAds,
  adminModifyAds,
  adminGetRunningAds,
  getAllAdsWithAcceptedReporters,
  getAdvertisementTargetedReporters,
  getFullAdvertisementDetails,
} = require("../../../controller/admin/adminAdevertismentSection/adminGetAllAds/adminGetAds");
const freeAds = require("../../../controller/admin/freeAds/freeAds");
const {freeAdsUpload} = require("../../../middlewares/multer/multer")

const adminAuthenticate = require("../../../middlewares/adminAuthenticate/adminAuthenticate");
const verifyAdminAccess = require("../../../middlewares/adminAuthenticate/verifyAdminAccess");
const isSuperAdmin = require("../../../middlewares/adminAuthenticate/isSuperAdmin");

router.post(
  "/admin/priceset",
  adminAuthenticate,
  isSuperAdmin,
  adminSetAdPrice
);

router.post("/fb/video/upload", adminAuthenticate, isSuperAdmin, fbVideoUpload);

router.post(
  "/admin/set/approved/adtiming",
  adminAuthenticate,
  isSuperAdmin,
  acceptingAdTimeing
);

router.post(
  "/admin/set/reporter/price",
  adminAuthenticate,
  isSuperAdmin,
  setReporterPrice
);

router.post(
  "/admin/set/paid-conference/commission",
  adminAuthenticate,
  isSuperAdmin,
  setPaidConferenceCommission
);

// Apply both middlewares per route
router.get(
  "/admin/get/all/ads",
  adminAuthenticate,
  verifyAdminAccess("advertisement"),
  adminGetAds
);

router.get(
  "/ads/accepted/by/reporters",
  adminAuthenticate,
  verifyAdminAccess("advertisement"), 
  getAllAdsWithAcceptedReporters
);

router.put(
  "/admin/advertisements/reject/:id",
  adminAuthenticate,
  verifyAdminAccess("advertisement"),
  rejectedAds
);

router.put(
  "/admin/advertisements/approve/:id",
  adminAuthenticate,
  verifyAdminAccess("advertisement"),
  approvedAds
);

router.put(
  "/admin/modify/ads/:adId",
  adminAuthenticate,
  verifyAdminAccess("advertisement"),
  adminModifyAds
);

router.get(
  "/admin/get/all/running/ads",
  adminAuthenticate,
  verifyAdminAccess("advertisement"),
  adminGetRunningAds
);

router.get(
  "/admin/get/ads/:adId/targeted-reporters",
  adminAuthenticate,
  verifyAdminAccess("advertisement"),
  getAdvertisementTargetedReporters
);

router.get(
  "/admin/get/full/advertisement-details/:adId",
  adminAuthenticate,
  verifyAdminAccess("advertisement"),
  getFullAdvertisementDetails
);

router.post(
  "/free/ads",
  adminAuthenticate,
  isSuperAdmin,
  freeAdsUpload,
  freeAds
);

module.exports = router;
